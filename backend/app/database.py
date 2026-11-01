import os
import datetime
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker


def get_utc_now() -> datetime.datetime:
    """Return timezone-aware current UTC datetime."""
    return datetime.datetime.now(datetime.timezone.utc)

# Environment-independent relative path pointing to backend/sunpower.db
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "sunpower.db")
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False}
)

# Explicitly enforce foreign key constraints in SQLite
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON;")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

