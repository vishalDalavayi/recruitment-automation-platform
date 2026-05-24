from sqlalchemy import create_engine, MetaData
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import get_settings, logger

_engine = None
_SessionLocal = None

def get_engine():
    """Lazy initializer for the database engine."""
    global _engine
    if _engine is None:
        settings = get_settings()
        if settings.database_url:
            _engine = create_engine(
                settings.database_url,
                pool_size=15,
                max_overflow=25,
                pool_timeout=30,
                pool_recycle=300,
                pool_pre_ping=True,
                connect_args={"connect_timeout": 10},
            )
            logger.info("Database engine initialized.")
        else:
            logger.warning("DATABASE_URL not configured — using in-memory SQLite")
            _engine = create_engine("sqlite:///:memory:")
    return _engine

def get_session_factory():
    """Lazy initializer for the session factory."""
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=get_engine())
    return _SessionLocal

# Schema constants
DB_SCHEMA = get_settings().db_schema
CANDIDATE_SCHEMA = get_settings().candidate_schema

# For backward compatibility with existing imports
class LazySessionLocal:
    def __call__(self, *args, **kwargs):
        return get_session_factory()(*args, **kwargs)

SessionLocal = LazySessionLocal()
Base = declarative_base(metadata=MetaData(schema=DB_SCHEMA))

def __getattr__(name):
    """Module-level getattr for lazy 'engine' access."""
    if name == "engine":
        return get_engine()
    raise AttributeError(f"module '{__name__}' has no attribute '{name}'")

def dispose_engine():
    """Dispose of the engine connection pool."""
    if _engine:
        _engine.dispose()
        logger.info("Database engine disposed.")
