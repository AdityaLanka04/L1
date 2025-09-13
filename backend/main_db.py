from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from . import models, database, auth
from jose import JWTError
import uvicorn

app = FastAPI()
database.init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")  # Or keep as "login" if using /login

def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/register")
def register(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if user:
        raise HTTPException(status_code=400, detail="Username already registered")
    new_user = models.User(
        username=form_data.username,
        email=form_data.username + "@example.com",
        hashed_password=auth.hash_password(form_data.password)
    )
    db.add(new_user)
    db.commit()
    return {"msg": "User registered successfully"}

@app.post("/token")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = auth.create_access_token(data={"sub": user.username})
    return {"access_token": token, "token_type": "bearer"}

@app.get("/me")
def read_users_me(token: str = Depends(oauth2_scheme)):
    try:
        payload = auth.decode_token(token)
        username = payload.get("sub")
        return {"username": username}
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

if __name__ == "__main__":
    uvicorn.run(app, host="localhost", port=8000)
