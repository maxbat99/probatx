import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Routers
from .routers import teams, aggregate, weather_global, geo_debug, stadiums

load_dotenv()

app = FastAPI(title=os.getenv("APP_NAME", "ProbaX"))

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = os.getenv("API_PREFIX", "/api/v1")

# Include routers
app.include_router(teams.router,         prefix=API_PREFIX)
app.include_router(aggregate.router,     prefix=API_PREFIX)
app.include_router(weather_global.router, prefix=API_PREFIX)
app.include_router(geo_debug.router,     prefix=API_PREFIX)
app.include_router(stadiums.router,      prefix=API_PREFIX)

@app.get("/")
def root():
    return {"ok": True, "name": "ProbaX Backend"}

