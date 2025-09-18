from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import os
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from pymongo import ReturnDocument

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

# Database
MONGODB_URI = os.environ.get("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME = os.environ.get("MONGODB_DB", "notes_demo")

mongo_client: Optional[AsyncIOMotorClient] = None


@app.on_event("startup")
async def startup_event():
    global mongo_client
    mongo_client = AsyncIOMotorClient(MONGODB_URI)
    # Quick ping to ensure connectivity
    await mongo_client.admin.command("ping")


@app.on_event("shutdown")
async def shutdown_event():
    global mongo_client
    if mongo_client is not None:
        mongo_client.close()


def notes_collection():
    assert mongo_client is not None, "Mongo client not initialized"
    return mongo_client[DB_NAME]["notes"]


# ---------- Routes ----------
@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/notes", response_model=List[NoteOut])
async def list_notes():
    cursor = notes_collection().find({}, sort=[("updated_at", -1)])
    items = [doc async for doc in cursor]
    return items


@app.get("/notes/{note_id}", response_model=NoteOut)
async def get_note(note_id: str):
    note = await notes_collection().find_one({"_id": PyObjectId.validate(note_id)})
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


@app.post("/notes", response_model=NoteOut, status_code=201)
async def create_note(payload: NoteCreate):
    now = datetime.utcnow()
    doc = {"title": payload.title, "content": payload.content, "created_at": now, "updated_at": now}
    result = await notes_collection().insert_one(doc)
    created = await notes_collection().find_one({"_id": result.inserted_id})
    assert created is not None
    return created


@app.put("/notes/{note_id}", response_model=NoteOut)
async def update_note(note_id: str, payload: NoteUpdate):
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
    return result


@app.delete("/notes/{note_id}", status_code=204)
async def delete_note(note_id: str):
    result = await notes_collection().delete_one({"_id": PyObjectId.validate(note_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    return None