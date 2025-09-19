from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import os
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from pymongo import ReturnDocument
import logging
from uuid import uuid4
from starlette.staticfiles import StaticFiles

# ---------- Logging ----------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("notes-api")


# ---------- Pydantic helpers ----------
class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if isinstance(v, ObjectId):
            return v
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)


# ---------- Schemas ----------
class NoteBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200, description="Note title")
    content: str = Field("", description="Note content body")
    images: List[str] = Field(default_factory=list, description="List of image URLs")


class NoteCreate(NoteBase):
    pass


class NoteUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    content: Optional[str] = None


class NoteOut(NoteBase):
    id: PyObjectId = Field(alias="_id")
    created_at: datetime
    updated_at: datetime

    class Config:
        json_encoders = {ObjectId: str}
        populate_by_name = True


# ---------- App ----------
app = FastAPI(title="Notes API", version="1.0.0")

# CORS for local Next.js dev
FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN, "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Static files (uploads) ----------
UPLOAD_DIR = os.environ.get("UPLOAD_DIR", os.path.join(os.path.dirname(__file__), "uploads"))
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# ---------- Database Config ----------
MONGO_USER = os.environ.get("MONGO_USER", "admin")
MONGO_PASS = os.environ.get("MONGO_PASS", "password123")
MONGO_HOST = os.environ.get("MONGO_HOST", "localhost")
MONGO_PORT = os.environ.get("MONGO_PORT", "27017")
MONGO_DB = os.environ.get("MONGO_DB", "notesdb")

# authSource=admin is required when using root user
MONGODB_URI = os.environ.get(
    "MONGODB_URI",
    f"mongodb://{MONGO_USER}:{MONGO_PASS}@{MONGO_HOST}:{MONGO_PORT}/{MONGO_DB}?authSource=admin",
)

mongo_client: Optional[AsyncIOMotorClient] = None


@app.on_event("startup")
async def startup_event():
    global mongo_client
    try:
        logger.info("Connecting to MongoDB...")
        mongo_client = AsyncIOMotorClient(MONGODB_URI)
        await mongo_client.admin.command("ping")
        logger.info(f"✅ Connected to MongoDB at {MONGO_HOST}:{MONGO_PORT}, DB: {MONGO_DB}")
    except Exception as e:
        logger.error(f"❌ Could not connect to MongoDB: {e}")
        raise e


@app.on_event("shutdown")
async def shutdown_event():
    global mongo_client
    if mongo_client is not None:
        logger.info("Closing MongoDB connection...")
        mongo_client.close()


def notes_collection():
    assert mongo_client is not None, "Mongo client not initialized"
    return mongo_client[MONGO_DB]["notes"]


# ---------- Routes ----------
@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/notes")
async def list_notes():
    try:
        cursor = notes_collection().find({}, sort=[("updated_at", -1)])
        items = [doc async for doc in cursor]
        # Convert ObjectId to string for JSON serialization
        for item in items:
            item["_id"] = str(item["_id"])
        return items
    except Exception as e:
        logger.error(f"Error fetching notes: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch notes")


@app.get("/notes/{note_id}")
async def get_note(note_id: str):
    try:
        note = await notes_collection().find_one({"_id": PyObjectId.validate(note_id)})
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        note["_id"] = str(note["_id"])
        return note
    except Exception as e:
        logger.error(f"Error fetching note {note_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch note")


@app.post("/notes", status_code=201)
async def create_note(payload: NoteCreate):
    try:
        now = datetime.utcnow()
        doc = {"title": payload.title, "content": payload.content, "images": payload.images or [], "created_at": now, "updated_at": now}
        result = await notes_collection().insert_one(doc)
        created = await notes_collection().find_one({"_id": result.inserted_id})
        if created:
            created["_id"] = str(created["_id"])
        return created
    except Exception as e:
        logger.error(f"Error creating note: {e}")
        raise HTTPException(status_code=500, detail="Failed to create note")


@app.put("/notes/{note_id}")
async def update_note(note_id: str, payload: NoteUpdate):
    try:
        update_data = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
        if not update_data:
            # force an update to touch updated_at
            update_data = {}
        update = {"$set": {**update_data, "updated_at": datetime.utcnow()}}
        result = await notes_collection().find_one_and_update(
            {"_id": PyObjectId.validate(note_id)},
            update,
            return_document=ReturnDocument.AFTER,
        )
        if not result:
            raise HTTPException(status_code=404, detail="Note not found")
        result["_id"] = str(result["_id"])
        return result
    except Exception as e:
        logger.error(f"Error updating note {note_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update note")


@app.delete("/notes/{note_id}", status_code=204)
async def delete_note(note_id: str):
    try:
        result = await notes_collection().delete_one({"_id": PyObjectId.validate(note_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Note not found")
        return None
    except Exception as e:
        logger.error(f"Error deleting note {note_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete note")


# ---------- Image upload/delete ----------
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
MAX_FILES_PER_NOTE = int(os.environ.get("MAX_FILES_PER_NOTE", "5"))
MAX_FILE_SIZE_MB = int(os.environ.get("MAX_FILE_SIZE_MB", "5"))


@app.post("/notes/{note_id}/images")
async def upload_images(note_id: str, files: List[UploadFile] = File(...)):
    try:
        note = await notes_collection().find_one({"_id": PyObjectId.validate(note_id)})
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")

        existing_images: List[str] = note.get("images", [])
        remaining_slots = MAX_FILES_PER_NOTE - len(existing_images)
        if remaining_slots <= 0:
            raise HTTPException(status_code=400, detail="Image limit reached for this note")

        to_process = files[:remaining_slots]
        saved_urls: List[str] = []

        for f in to_process:
            if f.content_type not in ALLOWED_MIME:
                raise HTTPException(status_code=400, detail=f"Unsupported type: {f.content_type}")
            # size check by reading into memory in chunks
            data = await f.read()
            size_mb = len(data) / (1024 * 1024)
            if size_mb > MAX_FILE_SIZE_MB:
                raise HTTPException(status_code=400, detail=f"File too large (> {MAX_FILE_SIZE_MB} MB)")
            ext = {
                "image/jpeg": ".jpg",
                "image/png": ".png",
                "image/webp": ".webp",
            }[f.content_type]
            name = f"{uuid4().hex}{ext}"
            dest_path = os.path.join(UPLOAD_DIR, name)
            with open(dest_path, "wb") as out:
                out.write(data)
            saved_urls.append(f"/uploads/{name}")

        new_images = existing_images + saved_urls
        updated = await notes_collection().find_one_and_update(
            {"_id": PyObjectId.validate(note_id)},
            {"$set": {"images": new_images, "updated_at": datetime.utcnow()}},
            return_document=ReturnDocument.AFTER,
        )
        assert updated is not None
        updated["_id"] = str(updated["_id"])
        return updated
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading images for note {note_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload images")


@app.delete("/notes/{note_id}/images")
async def delete_image(note_id: str, url: str):
    try:
        note = await notes_collection().find_one({"_id": PyObjectId.validate(note_id)})
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        images: List[str] = note.get("images", [])
        if url not in images:
            raise HTTPException(status_code=404, detail="Image not found on this note")

        # remove file from disk if under /uploads
        if url.startswith("/uploads/"):
            file_path = os.path.join(UPLOAD_DIR, os.path.basename(url))
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception as e:
                    logger.warning(f"Failed to remove file {file_path}: {e}")

        new_images = [i for i in images if i != url]
        updated = await notes_collection().find_one_and_update(
            {"_id": PyObjectId.validate(note_id)},
            {"$set": {"images": new_images, "updated_at": datetime.utcnow()}},
            return_document=ReturnDocument.AFTER,
        )
        assert updated is not None
        updated["_id"] = str(updated["_id"])
        return updated
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting image for note {note_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete image")
