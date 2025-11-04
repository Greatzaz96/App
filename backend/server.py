from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
from passlib.context import CryptContext
import jwt
from bson import ObjectId
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
SECRET_KEY = os.environ.get("JWT_SECRET", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.race_participants: Dict[str, List[str]] = {}  # race_id -> [user_ids]

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json(message)
            except:
                pass

    async def broadcast_to_race(self, message: dict, race_id: str):
        if race_id in self.race_participants:
            for user_id in self.race_participants[race_id]:
                await self.send_personal_message(message, user_id)

    def add_to_race(self, race_id: str, user_id: str):
        if race_id not in self.race_participants:
            self.race_participants[race_id] = []
        if user_id not in self.race_participants[race_id]:
            self.race_participants[race_id].append(user_id)

    def remove_from_race(self, race_id: str, user_id: str):
        if race_id in self.race_participants and user_id in self.race_participants[race_id]:
            self.race_participants[race_id].remove(user_id)

manager = ConnectionManager()

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Models
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    id: str
    email: str
    name: str
    profile_picture: Optional[str] = None
    created_at: datetime
    stats: Dict[str, Any] = {}

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: User

class Coordinate(BaseModel):
    latitude: float
    longitude: float

class CircuitCreate(BaseModel):
    name: str
    coordinates: List[Coordinate]
    distance: float
    is_public: bool = True

class Circuit(BaseModel):
    id: str
    name: str
    creator_id: str
    creator_name: str
    coordinates: List[Coordinate]
    distance: float
    is_public: bool
    created_at: datetime

class RaceCreate(BaseModel):
    circuit_id: str

class Race(BaseModel):
    id: str
    circuit_id: str
    circuit_name: str
    creator_id: str
    creator_name: str
    status: str  # "waiting", "active", "completed"
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    participants: List[str] = []
    created_at: datetime

class PositionUpdate(BaseModel):
    race_id: str
    latitude: float
    longitude: float
    speed: float
    timestamp: datetime

class RaceParticipant(BaseModel):
    id: str
    race_id: str
    user_id: str
    user_name: str
    positions: List[Dict[str, Any]] = []
    final_time: Optional[float] = None
    rank: Optional[int] = None
    status: str = "active"  # "active", "finished", "dnf"

class FriendRequest(BaseModel):
    friend_email: str

class Friend(BaseModel):
    id: str
    user_id: str
    friend_id: str
    friend_name: str
    friend_email: str
    status: str  # "pending", "accepted"
    created_at: datetime

class GroupCreate(BaseModel):
    name: str
    member_ids: List[str] = []

class Group(BaseModel):
    id: str
    name: str
    creator_id: str
    members: List[Dict[str, str]] = []  # [{id, name}]
    created_at: datetime

# Helper functions
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        
        user = await db.users.find_one({"_id": user_id})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Authentication Routes
@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserRegister):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_id = str(uuid.uuid4())
    user_dict = {
        "_id": user_id,
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "name": user_data.name,
        "profile_picture": None,
        "created_at": datetime.utcnow(),
        "stats": {"total_races": 0, "wins": 0, "total_distance": 0}
    }
    await db.users.insert_one(user_dict)
    
    # Create token
    access_token = create_access_token({"sub": user_id})
    
    user = User(
        id=user_id,
        email=user_data.email,
        name=user_data.name,
        created_at=user_dict["created_at"],
        stats=user_dict["stats"]
    )
    
    return TokenResponse(access_token=access_token, user=user)

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    access_token = create_access_token({"sub": user["_id"]})
    
    user_obj = User(
        id=user["_id"],
        email=user["email"],
        name=user["name"],
        profile_picture=user.get("profile_picture"),
        created_at=user["created_at"],
        stats=user.get("stats", {})
    )
    
    return TokenResponse(access_token=access_token, user=user_obj)

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: dict = Depends(get_current_user)):
    return User(
        id=current_user["_id"],
        email=current_user["email"],
        name=current_user["name"],
        profile_picture=current_user.get("profile_picture"),
        created_at=current_user["created_at"],
        stats=current_user.get("stats", {})
    )

# Circuit Routes
@api_router.post("/circuits", response_model=Circuit)
async def create_circuit(circuit_data: CircuitCreate, current_user: dict = Depends(get_current_user)):
    circuit_id = str(uuid.uuid4())
    circuit_dict = {
        "_id": circuit_id,
        "name": circuit_data.name,
        "creator_id": current_user["_id"],
        "creator_name": current_user["name"],
        "coordinates": [coord.dict() for coord in circuit_data.coordinates],
        "distance": circuit_data.distance,
        "is_public": circuit_data.is_public,
        "created_at": datetime.utcnow()
    }
    await db.circuits.insert_one(circuit_dict)
    
    return Circuit(**{k: v for k, v in circuit_dict.items() if k != "_id"}, id=circuit_id)

@api_router.get("/circuits", response_model=List[Circuit])
async def get_circuits(is_public: Optional[bool] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if is_public is not None:
        if is_public:
            query["is_public"] = True
        else:
            query["creator_id"] = current_user["_id"]
    else:
        # Return both public and user's private circuits
        query = {"$or": [{"is_public": True}, {"creator_id": current_user["_id"]}]}
    
    circuits = await db.circuits.find(query).sort("created_at", -1).to_list(1000)
    return [Circuit(**{k: v for k, v in c.items() if k != "_id"}, id=c["_id"]) for c in circuits]

@api_router.get("/circuits/{circuit_id}", response_model=Circuit)
async def get_circuit(circuit_id: str, current_user: dict = Depends(get_current_user)):
    circuit = await db.circuits.find_one({"_id": circuit_id})
    if not circuit:
        raise HTTPException(status_code=404, detail="Circuit not found")
    return Circuit(**{k: v for k, v in circuit.items() if k != "_id"}, id=circuit["_id"])

@api_router.delete("/circuits/{circuit_id}")
async def delete_circuit(circuit_id: str, current_user: dict = Depends(get_current_user)):
    circuit = await db.circuits.find_one({"_id": circuit_id})
    if not circuit:
        raise HTTPException(status_code=404, detail="Circuit not found")
    if circuit["creator_id"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="Not authorized to delete this circuit")
    
    await db.circuits.delete_one({"_id": circuit_id})
    return {"message": "Circuit deleted successfully"}

# Race Routes
@api_router.post("/races", response_model=Race)
async def create_race(race_data: RaceCreate, current_user: dict = Depends(get_current_user)):
    # Get circuit
    circuit = await db.circuits.find_one({"_id": race_data.circuit_id})
    if not circuit:
        raise HTTPException(status_code=404, detail="Circuit not found")
    
    race_id = str(uuid.uuid4())
    race_dict = {
        "_id": race_id,
        "circuit_id": race_data.circuit_id,
        "circuit_name": circuit["name"],
        "creator_id": current_user["_id"],
        "creator_name": current_user["name"],
        "status": "waiting",
        "participants": [current_user["_id"]],
        "created_at": datetime.utcnow()
    }
    await db.races.insert_one(race_dict)
    
    # Create participant entry
    participant_dict = {
        "_id": str(uuid.uuid4()),
        "race_id": race_id,
        "user_id": current_user["_id"],
        "user_name": current_user["name"],
        "positions": [],
        "status": "active"
    }
    await db.race_participants.insert_one(participant_dict)
    
    return Race(**{k: v for k, v in race_dict.items() if k != "_id"}, id=race_id)

@api_router.get("/races", response_model=List[Race])
async def get_races(status: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if status:
        query["status"] = status
    
    races = await db.races.find(query).sort("created_at", -1).to_list(1000)
    return [Race(**{k: v for k, v in r.items() if k != "_id"}, id=r["_id"]) for r in races]

@api_router.get("/races/{race_id}", response_model=Race)
async def get_race(race_id: str, current_user: dict = Depends(get_current_user)):
    race = await db.races.find_one({"_id": race_id})
    if not race:
        raise HTTPException(status_code=404, detail="Race not found")
    return Race(**{k: v for k, v in race.items() if k != "_id"}, id=race["_id"])

@api_router.post("/races/{race_id}/join")
async def join_race(race_id: str, current_user: dict = Depends(get_current_user)):
    race = await db.races.find_one({"_id": race_id})
    if not race:
        raise HTTPException(status_code=404, detail="Race not found")
    
    if race["status"] != "waiting":
        raise HTTPException(status_code=400, detail="Race has already started or completed")
    
    if current_user["_id"] in race["participants"]:
        raise HTTPException(status_code=400, detail="Already joined this race")
    
    # Add participant
    await db.races.update_one(
        {"_id": race_id},
        {"$push": {"participants": current_user["_id"]}}
    )
    
    # Create participant entry
    participant_dict = {
        "_id": str(uuid.uuid4()),
        "race_id": race_id,
        "user_id": current_user["_id"],
        "user_name": current_user["name"],
        "positions": [],
        "status": "active"
    }
    await db.race_participants.insert_one(participant_dict)
    
    return {"message": "Joined race successfully"}

@api_router.post("/races/{race_id}/start")
async def start_race(race_id: str, current_user: dict = Depends(get_current_user)):
    race = await db.races.find_one({"_id": race_id})
    if not race:
        raise HTTPException(status_code=404, detail="Race not found")
    
    if race["creator_id"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="Only race creator can start the race")
    
    if race["status"] != "waiting":
        raise HTTPException(status_code=400, detail="Race has already started or completed")
    
    # Start race
    await db.races.update_one(
        {"_id": race_id},
        {"$set": {"status": "active", "start_time": datetime.utcnow()}}
    )
    
    # Broadcast to all participants
    await manager.broadcast_to_race({
        "type": "race_started",
        "race_id": race_id,
        "start_time": datetime.utcnow().isoformat()
    }, race_id)
    
    return {"message": "Race started successfully"}

@api_router.get("/races/{race_id}/leaderboard", response_model=List[RaceParticipant])
async def get_race_leaderboard(race_id: str, current_user: dict = Depends(get_current_user)):
    participants = await db.race_participants.find({"race_id": race_id}).to_list(1000)
    
    # Sort by final_time if race is completed, otherwise by current progress
    result = []
    for p in participants:
        result.append(RaceParticipant(**{k: v for k, v in p.items() if k != "_id"}, id=p["_id"]))
    
    # Sort by final time (None values go to end)
    result.sort(key=lambda x: (x.final_time is None, x.final_time or float('inf')))
    
    return result

# Friend Routes
@api_router.post("/friends/request")
async def send_friend_request(friend_data: FriendRequest, current_user: dict = Depends(get_current_user)):
    # Find friend by email
    friend = await db.users.find_one({"email": friend_data.friend_email})
    if not friend:
        raise HTTPException(status_code=404, detail="User not found")
    
    if friend["_id"] == current_user["_id"]:
        raise HTTPException(status_code=400, detail="Cannot add yourself as friend")
    
    # Check if already friends or pending
    existing = await db.friends.find_one({
        "$or": [
            {"user_id": current_user["_id"], "friend_id": friend["_id"]},
            {"user_id": friend["_id"], "friend_id": current_user["_id"]}
        ]
    })
    if existing:
        raise HTTPException(status_code=400, detail="Friend request already exists")
    
    # Create friend request
    friend_dict = {
        "_id": str(uuid.uuid4()),
        "user_id": current_user["_id"],
        "friend_id": friend["_id"],
        "friend_name": friend["name"],
        "friend_email": friend["email"],
        "status": "pending",
        "created_at": datetime.utcnow()
    }
    await db.friends.insert_one(friend_dict)
    
    return {"message": "Friend request sent"}

@api_router.get("/friends", response_model=List[Friend])
async def get_friends(status: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {
        "$or": [
            {"user_id": current_user["_id"]},
            {"friend_id": current_user["_id"]}
        ]
    }
    if status:
        query["status"] = status
    
    friends = await db.friends.find(query).to_list(1000)
    
    result = []
    for f in friends:
        # Determine which user is the friend
        if f["user_id"] == current_user["_id"]:
            friend_id = f["friend_id"]
            friend_name = f["friend_name"]
            friend_email = f["friend_email"]
        else:
            # Need to get the other user's info
            other_user = await db.users.find_one({"_id": f["user_id"]})
            friend_id = f["user_id"]
            friend_name = other_user["name"] if other_user else "Unknown"
            friend_email = other_user["email"] if other_user else "Unknown"
        
        result.append(Friend(
            id=f["_id"],
            user_id=f["user_id"],
            friend_id=friend_id,
            friend_name=friend_name,
            friend_email=friend_email,
            status=f["status"],
            created_at=f["created_at"]
        ))
    
    return result

@api_router.post("/friends/{friend_id}/accept")
async def accept_friend_request(friend_id: str, current_user: dict = Depends(get_current_user)):
    friend = await db.friends.find_one({"_id": friend_id, "friend_id": current_user["_id"]})
    if not friend:
        raise HTTPException(status_code=404, detail="Friend request not found")
    
    await db.friends.update_one(
        {"_id": friend_id},
        {"$set": {"status": "accepted"}}
    )
    
    return {"message": "Friend request accepted"}

# Group Routes
@api_router.post("/groups", response_model=Group)
async def create_group(group_data: GroupCreate, current_user: dict = Depends(get_current_user)):
    group_id = str(uuid.uuid4())
    
    # Get member info
    members = [{"id": current_user["_id"], "name": current_user["name"]}]
    for member_id in group_data.member_ids:
        if member_id != current_user["_id"]:
            user = await db.users.find_one({"_id": member_id})
            if user:
                members.append({"id": user["_id"], "name": user["name"]})
    
    group_dict = {
        "_id": group_id,
        "name": group_data.name,
        "creator_id": current_user["_id"],
        "members": members,
        "created_at": datetime.utcnow()
    }
    await db.groups.insert_one(group_dict)
    
    return Group(**{k: v for k, v in group_dict.items() if k != "_id"}, id=group_id)

@api_router.get("/groups", response_model=List[Group])
async def get_groups(current_user: dict = Depends(get_current_user)):
    groups = await db.groups.find(
        {"members.id": current_user["_id"]}
    ).to_list(1000)
    
    return [Group(**{k: v for k, v in g.items() if k != "_id"}, id=g["_id"]) for g in groups]

# WebSocket endpoint
@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_json()
            
            if data.get("type") == "join_race":
                race_id = data.get("race_id")
                manager.add_to_race(race_id, user_id)
                
            elif data.get("type") == "position_update":
                # Save position update
                race_id = data.get("race_id")
                position_data = {
                    "latitude": data.get("latitude"),
                    "longitude": data.get("longitude"),
                    "speed": data.get("speed"),
                    "timestamp": datetime.utcnow().isoformat()
                }
                
                await db.race_participants.update_one(
                    {"race_id": race_id, "user_id": user_id},
                    {"$push": {"positions": position_data}}
                )
                
                # Broadcast to all race participants
                await manager.broadcast_to_race({
                    "type": "participant_position",
                    "user_id": user_id,
                    "position": position_data
                }, race_id)
                
            elif data.get("type") == "finish_race":
                race_id = data.get("race_id")
                final_time = data.get("final_time")
                
                # Update participant
                await db.race_participants.update_one(
                    {"race_id": race_id, "user_id": user_id},
                    {"$set": {"status": "finished", "final_time": final_time}}
                )
                
                # Update user stats
                await db.users.update_one(
                    {"_id": user_id},
                    {"$inc": {"stats.total_races": 1}}
                )
                
                # Broadcast finish
                await manager.broadcast_to_race({
                    "type": "participant_finished",
                    "user_id": user_id,
                    "final_time": final_time
                }, race_id)
                
    except WebSocketDisconnect:
        manager.disconnect(user_id)

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
