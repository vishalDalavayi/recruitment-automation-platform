from sqlalchemy import (
    create_engine,
    CHAR,
    Column,
    String,
    Text,
    Date,
    DateTime,
    Table,
    MetaData,
    Integer,
    Index,
    JSON,
    Numeric,
    ForeignKey,
    func,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from sqlalchemy.sql import text
from datetime import datetime, timezone
import os
import secrets
from config import DATABASE_URL, DB_SCHEMA, logger, CANDIDATE_SCHEMA

Base = declarative_base(metadata=MetaData(schema=DB_SCHEMA))

COLS_TO_SELECT = "serial_no, url, title, company, location, salary, posted_date, job_type, workplace_type, keyword, scraped_at"
LIST_COLS = "serial_no, title, company, location, posted_date, job_type, workplace_type, keyword"

# Simple in-memory cache for filters
_FILTER_CACHE = {"data": None, "timestamp": 0}
CACHE_TTL = 300  # 5 minutes


class InputActive(Base):
    __tablename__ = "input_active"
    serial_no = Column(Integer, primary_key=True, autoincrement=True)
    vendor_name = Column(Text)
    dice_search_link = Column(Text)

    __table_args__ = (Index("ix_input_active_link", "dice_search_link"),)


class InputInactive(Base):
    __tablename__ = "input_inactive"
    serial_no = Column(Integer, primary_key=True, autoincrement=True)
    vendor_name = Column(Text)
    dice_job_link = Column(Text)

    __table_args__ = (Index("ix_input_inactive_link", "dice_job_link"),)


class ActiveDiceJobs(Base):
    __tablename__ = "active_dice_jobs"
    serial_no = Column(Integer, primary_key=True, autoincrement=True)
    job_url = Column(Text)
    search_url = Column(Text)


class InactiveDiceJobs(Base):
    __tablename__ = "inactive_dice_jobs"
    serial_no = Column(Integer, primary_key=True, autoincrement=True)
    job_url = Column(Text)
    search_url = Column(Text)


class ActiveScrapedData(Base):
    __tablename__ = "active_scraped_data"
    serial_no = Column(Integer, primary_key=True, autoincrement=True)
    url = Column(Text)
    title = Column(Text)
    company = Column(Text)
    location = Column(Text)
    salary = Column(Text)
    posted_date = Column(Text)
    job_type = Column(Text)
    workplace_type = Column(Text)
    description = Column(Text)
    skills = Column(Text)
    experience_required = Column(Text)
    keyword = Column(Text)
    scraped_at = Column(DateTime, default=datetime.utcnow)
    last_checked_at = Column(DateTime, default=datetime.utcnow)
    missing_count = Column(Integer, default=0)

    __table_args__ = (
        Index("ix_active_serial_desc", "serial_no", postgresql_using="btree"),
        Index("ix_active_scraped_at", "scraped_at"),
        Index("ix_active_company", "company"),
        Index("ix_active_keyword", "keyword"),
    )


class InactiveScrapedData(Base):
    __tablename__ = "inactive_scraped_data"
    serial_no = Column(Integer, primary_key=True, autoincrement=True)
    url = Column(Text)
    title = Column(Text)
    company = Column(Text)
    location = Column(Text)
    salary = Column(Text)
    posted_date = Column(Text)
    job_type = Column(Text)
    workplace_type = Column(Text)
    description = Column(Text)
    skills = Column(Text)
    experience_required = Column(Text)
    keyword = Column(Text)
    scraped_at = Column(DateTime, default=datetime.utcnow)
    last_checked_at = Column(DateTime, default=datetime.utcnow)
    missing_count = Column(Integer, default=0)

    __table_args__ = (
        Index("ix_inactive_serial_desc", "serial_no", postgresql_using="btree"),
        Index("ix_inactive_scraped_at", "scraped_at"),
        Index("ix_inactive_company", "company"),
        Index("ix_inactive_keyword", "keyword"),
    )


class ScraperLog(Base):
    __tablename__ = "scraper_logs"
    serial_no = Column(Integer, primary_key=True, autoincrement=True)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    duration = Column(Integer)  # in seconds
    active_count = Column(Integer)
    inactive_count = Column(Integer)
    total_count = Column(Integer)
    status = Column(String(50))  # completed, stopped, failed
    error = Column(Text)
    config_snapshot = Column(JSON)
    triggered_by = Column(String(50))  # manual, scheduled


class Candidate(Base):
    __tablename__ = "candidate_basic_info"
    __table_args__ = {"schema": CANDIDATE_SCHEMA}

    unique_id = Column(CHAR(20), primary_key=True)
    first_name = Column(String(255), nullable=False)
    last_name = Column(String(255), nullable=False)
    contact = Column(String(50), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    visa_status = Column(String(50), nullable=False)
    skill_set = Column(Text, nullable=False)
    relocation = Column(String(10), nullable=False)
    graduation_year = Column(Integer, nullable=False)
    employment_type = Column(String(20), nullable=False)
    bill_rate = Column(Numeric(10, 2), nullable=True)
    raw_resume_path = Column(Text, nullable=False)
    passport_url = Column(Text)
    work_authorization_url = Column(Text)
    id_proof_url = Column(Text)
    formatted_resume_info = relationship(
        "FormattingResumeInfo",
        back_populates="candidate",
        uselist=False,
        cascade="all, delete-orphan",
        single_parent=True,
    )

    def _ensure_formatted_resume_info(self):
        if self.formatted_resume_info is None:
            self.formatted_resume_info = FormattingResumeInfo(
                unique_id=self.unique_id,
                source_raw_resume_path=self.raw_resume_path,
                formatted_resume_status="not_started",
                missing_field_details=[],
            )
        return self.formatted_resume_info

    @property
    def formatted_resume_status(self):
        if self.formatted_resume_info is None:
            return "not_started"
        return self.formatted_resume_info.formatted_resume_status or "not_started"

    @formatted_resume_status.setter
    def formatted_resume_status(self, value):
        self._ensure_formatted_resume_info().formatted_resume_status = value

    @property
    def formatted_resume_path(self):
        if self.formatted_resume_info is None:
            return None
        return self.formatted_resume_info.formatted_resume_path

    @formatted_resume_path.setter
    def formatted_resume_path(self, value):
        self._ensure_formatted_resume_info().formatted_resume_path = value

    @property
    def formatted_resume_file_name(self):
        if not self.formatted_resume_path:
            return None
        return os.path.basename(self.formatted_resume_path)

    @property
    def formatted_resume_content(self):
        if self.formatted_resume_info is None:
            return None
        return self.formatted_resume_info.formatted_resume_content

    @formatted_resume_content.setter
    def formatted_resume_content(self, value):
        self._ensure_formatted_resume_info().formatted_resume_content = value

    @property
    def formatted_resume_missing_field_details(self):
        if self.formatted_resume_info is None:
            return []
        return self.formatted_resume_info.missing_field_details or []

    @formatted_resume_missing_field_details.setter
    def formatted_resume_missing_field_details(self, value):
        self._ensure_formatted_resume_info().missing_field_details = value

    @property
    def formatted_resume_llm_info(self):
        if self.formatted_resume_info is None:
            return None
        return self.formatted_resume_info.llm_info

    @formatted_resume_llm_info.setter
    def formatted_resume_llm_info(self, value):
        self._ensure_formatted_resume_info().llm_info = value

    @property
    def formatted_resume_error(self):
        if self.formatted_resume_info is None:
            return None
        return self.formatted_resume_info.processing_error

    @formatted_resume_error.setter
    def formatted_resume_error(self, value):
        self._ensure_formatted_resume_info().processing_error = value

    @property
    def formatted_resume_processed_at(self):
        if self.formatted_resume_info is None:
            return None
        return self.formatted_resume_info.formatted_resume_processed_at

    @formatted_resume_processed_at.setter
    def formatted_resume_processed_at(self, value):
        self._ensure_formatted_resume_info().formatted_resume_processed_at = value

    @property
    def source_raw_resume_path(self):
        if self.formatted_resume_info is None:
            return None
        return self.formatted_resume_info.source_raw_resume_path

    @source_raw_resume_path.setter
    def source_raw_resume_path(self, value):
        self._ensure_formatted_resume_info().source_raw_resume_path = value


class FormattingResumeInfo(Base):
    __tablename__ = "formatting_resume_info"
    __table_args__ = {"schema": CANDIDATE_SCHEMA}

    unique_id = Column(
        CHAR(20),
        ForeignKey(
            f'{CANDIDATE_SCHEMA}.candidate_basic_info.unique_id',
            ondelete="CASCADE",
        ),
        primary_key=True,
    )
    source_raw_resume_path = Column(Text)
    formatted_resume_status = Column(String(32), nullable=False, default="not_started")
    formatted_resume_path = Column(Text)
    formatted_resume_content = Column(JSON)
    missing_field_details = Column(JSON)
    llm_info = Column(JSON)
    processing_error = Column(Text)
    formatted_resume_processed_at = Column(DateTime)

    candidate = relationship("Candidate", back_populates="formatted_resume_info")


engine = create_engine(
    DATABASE_URL, pool_pre_ping=True, pool_recycle=3600, pool_size=10, max_overflow=20
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


FORMATTED_RESUME_CANDIDATE_COLUMNS = {
    "formatted_resume_status",
    "formatted_resume_path",
    "formatted_resume_content",
    "formatted_resume_missing_field_details",
    "formatted_resume_llm_info",
    "formatted_resume_error",
    "formatted_resume_processed_at",
}

LEGACY_FORMATTED_RESUME_COLUMNS = [
    "formatted_resume_status",
    "formatted_resume_path",
    "formatted_resume_file_name",
    "formatted_resume_content",
    "formatted_resume_missing_field_details",
    "formatted_resume_llm_info",
    "formatted_resume_error",
    "formatted_resume_processed_at",
]


def _get_table_columns(conn, schema, table_name):
    rows = conn.execute(
        text(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = :schema AND table_name = :table_name
            """
        ),
        {"schema": schema, "table_name": table_name},
    ).fetchall()
    return {row[0] for row in rows}


def _migrate_candidate_formatting_data(conn):
    candidate_columns = _get_table_columns(conn, CANDIDATE_SCHEMA, "candidate_basic_info")
    old_columns = set(LEGACY_FORMATTED_RESUME_COLUMNS)

    if old_columns.issubset(candidate_columns):
        conn.execute(
            text(
                f"""
                INSERT INTO "{CANDIDATE_SCHEMA}"."formatting_resume_info" (
                    unique_id,
                    source_raw_resume_path,
                    formatted_resume_status,
                    formatted_resume_path,
                    formatted_resume_content,
                    missing_field_details,
                    llm_info,
                    processing_error,
                    formatted_resume_processed_at
                )
                SELECT
                    candidate.unique_id,
                    candidate.raw_resume_path,
                    COALESCE(candidate.formatted_resume_status, 'not_started'),
                    candidate.formatted_resume_path,
                    candidate.formatted_resume_content,
                    COALESCE(candidate.formatted_resume_missing_field_details, '[]'::json),
                    candidate.formatted_resume_llm_info,
                    candidate.formatted_resume_error,
                    candidate.formatted_resume_processed_at
                FROM "{CANDIDATE_SCHEMA}"."candidate_basic_info" AS candidate
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM "{CANDIDATE_SCHEMA}"."formatting_resume_info" AS formatting
                    WHERE formatting.unique_id = candidate.unique_id
                )
                """
            )
        )

    conn.execute(
        text(
            f"""
            INSERT INTO "{CANDIDATE_SCHEMA}"."formatting_resume_info" (
                unique_id,
                source_raw_resume_path,
                formatted_resume_status,
                missing_field_details
            )
            SELECT
                candidate.unique_id,
                candidate.raw_resume_path,
                'not_started',
                '[]'::json
            FROM "{CANDIDATE_SCHEMA}"."candidate_basic_info" AS candidate
            WHERE NOT EXISTS (
                SELECT 1
                FROM "{CANDIDATE_SCHEMA}"."formatting_resume_info" AS formatting
                WHERE formatting.unique_id = candidate.unique_id
            )
            """
        )
    )

    conn.execute(
        text(
            f"""
            UPDATE "{CANDIDATE_SCHEMA}"."formatting_resume_info" AS formatting
            SET source_raw_resume_path = candidate.raw_resume_path
            FROM "{CANDIDATE_SCHEMA}"."candidate_basic_info" AS candidate
            WHERE formatting.unique_id = candidate.unique_id
              AND (formatting.source_raw_resume_path IS NULL OR formatting.source_raw_resume_path = '')
            """
        )
    )

    conn.execute(
        text(
            f"""
            UPDATE "{CANDIDATE_SCHEMA}"."formatting_resume_info"
            SET formatted_resume_status = 'not_started'
            WHERE formatted_resume_status IS NULL
            """
        )
    )

    conn.execute(
        text(
            f"""
            UPDATE "{CANDIDATE_SCHEMA}"."formatting_resume_info"
            SET missing_field_details = '[]'::json
            WHERE missing_field_details IS NULL
            """
        )
    )


def _drop_legacy_candidate_formatting_columns(conn):
    for column_name in LEGACY_FORMATTED_RESUME_COLUMNS:
        conn.execute(
            text(
                f"""
                ALTER TABLE "{CANDIDATE_SCHEMA}"."candidate_basic_info"
                DROP COLUMN IF EXISTS {column_name}
                """
            )
        )


def _migrate_checker_columns(conn):
    """Add last_checked_at and missing_count to scraped tables if missing"""
    for table in ["active_scraped_data", "inactive_scraped_data"]:
        cols = _get_table_columns(conn, DB_SCHEMA, table)
        if "last_checked_at" not in cols:
            conn.execute(text(f'ALTER TABLE "{DB_SCHEMA}"."{table}" ADD COLUMN last_checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'))
        if "missing_count" not in cols:
            conn.execute(text(f'ALTER TABLE "{DB_SCHEMA}"."{table}" ADD COLUMN missing_count INTEGER DEFAULT 0'))

def init_db():
    try:
        with engine.connect() as conn:
            conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {DB_SCHEMA}"))
            conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {CANDIDATE_SCHEMA}"))
            conn.commit()

        Base.metadata.create_all(bind=engine)
        with engine.connect() as conn:
            _migrate_candidate_formatting_data(conn)
            _drop_legacy_candidate_formatting_columns(conn)
            _migrate_checker_columns(conn)
            conn.commit()
        logger.info(
            f"Database initialized in schemas: {DB_SCHEMA}, {CANDIDATE_SCHEMA}"
        )
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        raise


def dispose_db_engine():
    engine.dispose()


class DBManager:
    def __init__(self):
        self.session = SessionLocal()

    def _get_model_schema_and_table(self, table_name):
        model = self._get_model_by_table(table_name)
        if not model:
            return None, None, None

        table = model.__table__
        schema = table.schema or DB_SCHEMA
        return model, schema, table.name

    def _get_fully_qualified_table_name(self, table_name):
        model, schema, actual_table_name = self._get_model_schema_and_table(table_name)
        if not model:
            return None
        return f'"{schema}"."{actual_table_name}"'

    def _generate_candidate_unique_id(self):
        for _ in range(10):
            unique_id = f"{secrets.randbelow(10**20):020d}"
            exists = (
                self.session.query(Candidate.unique_id)
                .filter(Candidate.unique_id == unique_id)
                .first()
            )
            if not exists:
                return unique_id
        raise RuntimeError("Unable to generate a unique candidate identifier")

    def generate_candidate_unique_id(self):
        return self._generate_candidate_unique_id()

    def _get_model_by_table(self, table_name):
        mapping = {
            "input_active": InputActive,
            "input_inactive": InputInactive,
            "active_dice_jobs": ActiveDiceJobs,
            "inactive_dice_jobs": InactiveDiceJobs,
            "active_scraped_data": ActiveScrapedData,
            "inactive_scraped_data": InactiveScrapedData,
            "scraper_logs": ScraperLog,
            "candidates": Candidate,
        }
        return mapping.get(table_name)

    def save_active_jobs(self, jobs):
        for job_data in jobs:
            job = ActiveScrapedData(**job_data)
            self.session.merge(job)
        self.session.commit()

    def save_inactive_jobs(self, jobs):
        for job_data in jobs:
            job = InactiveScrapedData(**job_data)
            self.session.merge(job)
        self.session.commit()

    def get_existing_job_urls(self, table_name):
        model, schema, actual_table_name = self._get_model_schema_and_table(table_name)
        if not model:
            return []

        col = "url" if hasattr(model, "url") else "job_url"
        result = self.session.execute(
            text(f"""
            SELECT {col} FROM "{schema}"."{actual_table_name}" LIMIT 1000
        """)
        )
        return [row[0] for row in result]

    def append_scraped_data(self, table_name, job_dicts):
        model = self._get_model_by_table(table_name)
        for data in job_dicts:
            job = model(**data)
            self.session.merge(job)
        self.session.commit()

    def add_scraper_log(self, log_data):
        log = ScraperLog(**log_data)
        self.session.add(log)
        self.session.commit()

    def get_scraper_logs(self, limit=50):
        result = self.session.execute(
            text(
                f"SELECT * FROM {DB_SCHEMA}.scraper_logs ORDER BY start_time DESC LIMIT :limit"
            ),
            {"limit": limit},
        )
        rows = result.fetchall()
        # Get columns from model for dict conversion
        columns = [c.name for c in ScraperLog.__table__.columns]
        return [dict(zip(columns, row)) for row in rows]

    def add_candidate(self, data):
        candidate_data = dict(data)
        candidate_data.setdefault("unique_id", self._generate_candidate_unique_id())
        candidate_columns = {column.name for column in Candidate.__table__.columns}
        formatter_data = {
            key: candidate_data.pop(key)
            for key in list(candidate_data.keys())
            if key in FORMATTED_RESUME_CANDIDATE_COLUMNS
            or key == "source_raw_resume_path"
            or key == "formatted_resume_file_name"
        }

        candidate = Candidate(
            **{key: value for key, value in candidate_data.items() if key in candidate_columns}
        )
        candidate.formatted_resume_info = FormattingResumeInfo(
            unique_id=candidate.unique_id,
            source_raw_resume_path=formatter_data.get("source_raw_resume_path")
            or candidate.raw_resume_path,
            formatted_resume_status=formatter_data.get(
                "formatted_resume_status", "not_started"
            ),
            formatted_resume_path=formatter_data.get("formatted_resume_path"),
            formatted_resume_content=formatter_data.get("formatted_resume_content"),
            missing_field_details=formatter_data.get(
                "formatted_resume_missing_field_details", []
            ),
            llm_info=formatter_data.get("formatted_resume_llm_info"),
            processing_error=formatter_data.get("formatted_resume_error"),
            formatted_resume_processed_at=formatter_data.get(
                "formatted_resume_processed_at"
            ),
        )
        self.session.add(candidate)
        self.session.commit()
        return candidate.unique_id

    def update_candidate(self, unique_id, data):
        candidate = (
            self.session.query(Candidate)
            .filter(Candidate.unique_id == unique_id)
            .first()
        )
        if not candidate:
            return False
        formatter_data = {}
        for key, value in data.items():
            if hasattr(candidate, key):
                setattr(candidate, key, value)
            elif key in FORMATTED_RESUME_CANDIDATE_COLUMNS or key == "source_raw_resume_path":
                formatter_data[key] = value

        if "raw_resume_path" in data and "source_raw_resume_path" not in formatter_data:
            formatter_data["source_raw_resume_path"] = data["raw_resume_path"]

        if formatter_data:
            formatted_resume_info = candidate._ensure_formatted_resume_info()
            field_mapping = {
                "formatted_resume_status": "formatted_resume_status",
                "formatted_resume_path": "formatted_resume_path",
                "formatted_resume_content": "formatted_resume_content",
                "formatted_resume_missing_field_details": "missing_field_details",
                "formatted_resume_llm_info": "llm_info",
                "formatted_resume_error": "processing_error",
                "formatted_resume_processed_at": "formatted_resume_processed_at",
                "source_raw_resume_path": "source_raw_resume_path",
            }
            for key, value in formatter_data.items():
                mapped_field = field_mapping.get(key)
                if mapped_field:
                    setattr(formatted_resume_info, mapped_field, value)
        self.session.commit()
        return True

    def delete_candidate(self, unique_id):
        candidate = (
            self.session.query(Candidate)
            .filter(Candidate.unique_id == unique_id)
            .first()
        )
        if not candidate:
            return False
        self.session.delete(candidate)
        self.session.commit()
        return True

    def get_candidates(self, limit=50):
        _, schema, actual_table_name = self._get_model_schema_and_table("candidates")
        result = self.session.execute(
            text(
                f'SELECT * FROM "{schema}"."{actual_table_name}" ORDER BY unique_id DESC LIMIT :limit'
            ),
            {"limit": limit},
        )
        rows = result.fetchall()
        columns = [c.name for c in Candidate.__table__.columns]
        return [dict(zip(columns, row)) for row in rows]

    def append_discovered_links(self, table_name, links):
        model = self._get_model_by_table(table_name)
        if not model:
            return
        for search_url, job_url in links:
            job = model(search_url=search_url, job_url=job_url)
            self.session.merge(job)
        self.session.commit()

    def get_all_records(self, table_name, limit=1000):
        model, schema, actual_table_name = self._get_model_schema_and_table(table_name)
        if not model:
            return []

        cols = ", ".join([c.name for c in model.__table__.columns])
        result = self.session.execute(
            text(f"""
            SELECT {cols} FROM "{schema}"."{actual_table_name}" LIMIT :limit
        """),
            {"limit": limit},
        )

        rows = result.fetchall()
        columns = [c.name for c in model.__table__.columns]
        return [dict(zip(columns, row)) for row in rows]

    def get_jobs_union_paginated(
        self,
        page=1,
        limit=20,
        get_total=True,
        search=None,
        company=None,
        location=None,
        vendor=None,
        job_type=None,
        last_id=None,
    ):
        """Fetches jobs with server-side filtering and cursor-based pagination"""
        cols = "s.title, s.company, s.location, s.job_type, s.posted_date, s.keyword"

        where_active = ["1=1"]
        where_inactive = ["1=1"]
        params = {"limit": limit}

        include_active = job_type in [None, "active", "both"]
        include_inactive = job_type in [None, "inactive", "both"]

        if search:
            where_active.append("(s.title ILIKE :search OR s.company ILIKE :search)")
            where_inactive.append("(s.title ILIKE :search OR s.company ILIKE :search)")
            params["search"] = f"%{search}%"
        if company:
            where_active.append("s.company = :company")
            where_inactive.append("s.company = :company")
            params["company"] = company
        if location:
            where_active.append("s.location = :location")
            where_inactive.append("s.location = :location")
            params["location"] = location
        if vendor:
            where_active.append("i.vendor_name = :vendor")
            where_inactive.append("i.vendor_name = :vendor")
            params["vendor"] = vendor

        if last_id is not None:
            where_active.append("s.serial_no < :last_id")
            where_inactive.append("s.serial_no < :last_id")
            params["last_id"] = last_id

        wa = " AND ".join(where_active)
        wi = " AND ".join(where_inactive)

        parts = []
        if include_active:
            # We always join to display the vendor name, but the WHERE clause filters it if provided
            parts.append(f"""
                SELECT {cols}, i.vendor_name as vendor, 'active' as type, s.serial_no as serial_no
                FROM {DB_SCHEMA}.active_scraped_data s
                LEFT JOIN {DB_SCHEMA}.input_active i ON s.keyword = i.dice_search_link
                WHERE {wa}
            """)
        if include_inactive:
            parts.append(f"""
                SELECT {cols}, i.vendor_name as vendor, 'inactive' as type, s.serial_no as serial_no
                FROM {DB_SCHEMA}.inactive_scraped_data s
                LEFT JOIN {DB_SCHEMA}.input_inactive i ON s.keyword = i.dice_job_link
                WHERE {wi}
            """)

        if not parts:
            return [], 0, None

        offset = (page - 1) * limit
        params["offset"] = offset
        
        query = " UNION ALL ".join(parts) + " ORDER BY serial_no DESC LIMIT :limit OFFSET :offset"

        try:
            result = self.session.execute(text(query), params)
            rows = result.fetchall()
        except Exception as e:
            logger.error(f"Query execution failed: {e}, params: {params}")
            raise

        total = 0
        if get_total and page == 1:
            count_parts = []
            if include_active:
                join_clause = ""
                if vendor:
                    join_clause = f"LEFT JOIN {DB_SCHEMA}.input_active i ON s.keyword = i.dice_search_link"
                
                count_parts.append(
                    f"SELECT COUNT(*) FROM {DB_SCHEMA}.active_scraped_data s {join_clause} WHERE {wa.replace('s.serial_no < :last_id', '1=1')}"
                )
            if include_inactive:
                join_clause = ""
                if vendor:
                    join_clause = f"LEFT JOIN {DB_SCHEMA}.input_inactive i ON s.keyword = i.dice_job_link"
                    
                count_parts.append(
                    f"SELECT COUNT(*) FROM {DB_SCHEMA}.inactive_scraped_data s {join_clause} WHERE {wi.replace('s.serial_no < :last_id', '1=1')}"
                )

            count_query = "SELECT (" + ") + (".join(count_parts) + ") as total"
            count_params = {k: v for k, v in params.items() if k != "last_id"}
            total_result = self.session.execute(text(count_query), count_params)
            total = total_result.fetchone()[0]

        records = []
        next_last_id = None
        for row in rows:
            rec = dict(row._mapping)
            next_last_id = rec.get("serial_no")
            records.append(rec)

        return records, total, next_last_id

    def get_job_detail(self, serial_no, job_type):
        """Get full job details including heavy fields"""
        from config import logger

        try:
            if job_type == "active":
                result = self.session.execute(
                    text(f"""
                    SELECT s.*, i.vendor_name as vendor
                    FROM {DB_SCHEMA}.active_scraped_data s
                    LEFT JOIN {DB_SCHEMA}.input_active i ON s.keyword = i.dice_search_link
                    WHERE s.serial_no = :serial_no
                """),
                    {"serial_no": serial_no},
                )
            else:
                result = self.session.execute(
                    text(f"""
                    SELECT s.*, i.vendor_name as vendor
                    FROM {DB_SCHEMA}.inactive_scraped_data s
                    LEFT JOIN {DB_SCHEMA}.input_inactive i ON s.keyword = i.dice_job_link
                    WHERE s.serial_no = :serial_no
                """),
                    {"serial_no": serial_no},
                )

            row = result.fetchone()
            if not row:
                logger.warning(
                    f"No job found for serial_no={serial_no}, job_type={job_type}"
                )
                return None

            return dict(row._mapping)
        except Exception as e:
            logger.error(f"Error fetching job detail: {e}")
            return None

    def get_table_data(self, table_name, page=1, limit=50):
        model, schema, actual_table_name = self._get_model_schema_and_table(table_name)
        if not model:
            return [], 0, []

        offset = (page - 1) * limit
        cols = ", ".join([c.name for c in model.__table__.columns])
        primary_key_col = next(iter(model.__table__.primary_key.columns), None)
        order_col = primary_key_col.name if primary_key_col is not None else model.__table__.columns[0].name

        # Pagination query
        result = self.session.execute(
            text(f"""
            SELECT {cols} FROM "{schema}"."{actual_table_name}"
            ORDER BY "{order_col}" DESC
            LIMIT :limit OFFSET :offset
        """),
            {"limit": limit, "offset": offset},
        )

        rows = result.fetchall()
        columns = [c.name for c in model.__table__.columns]
        records = [dict(zip(columns, row)) for row in rows]

        # Only fetch total on first page for performance (frontend caches this)
        total = 0
        if page == 1:
            count_result = self.session.execute(
                text(f'SELECT COUNT(*) FROM "{schema}"."{actual_table_name}"')
            )
            total = count_result.fetchone()[0]

        return records, total, columns

    def clear_all_data(self, table_name):
        model, schema, actual_table_name = self._get_model_schema_and_table(table_name)
        if not model:
            return
        self.session.execute(text(f'DELETE FROM "{schema}"."{actual_table_name}"'))
        self.session.commit()

    def get_table_info(self, table_name):
        model, schema, actual_table_name = self._get_model_schema_and_table(table_name)
        if not model:
            return None

        col_info = []
        for col in model.__table__.columns:
            col_info.append(
                {
                    "name": col.name,
                    "type": str(col.type),
                    "nullable": col.nullable,
                    "primary_key": col.primary_key,
                }
            )

        result = self.session.execute(
            text(f'SELECT COUNT(*) FROM "{schema}"."{actual_table_name}"')
        )
        row_count = result.fetchone()[0]

        return {
            "columns": col_info,
            "row_count": row_count,
            "table_name": actual_table_name,
            "schema": schema,
        }


    def get_fast_count(self, table_name):
        """Get the exact row count for a table. Performance is fine for these table sizes."""
        try:
            model, schema, actual_table_name = self._get_model_schema_and_table(table_name)
            if not model:
                return 0

            # Use exact count - for tables under 1M rows this is sub-millisecond in Postgres
            exact_count = self.session.execute(
                text(f'SELECT COUNT(*) FROM "{schema}"."{actual_table_name}"')
            )
            return exact_count.fetchone()[0]
        except Exception as e:
            from config import logger
            logger.warning(f"Failed to get count for {table_name}: {e}")
            return 0

    def get_unique_filters(self):
        """Get unique values ONLY for records that actually have associated jobs - Cached for 5m"""
        import time

        global _FILTER_CACHE

        now = time.time()
        if _FILTER_CACHE["data"] and (now - _FILTER_CACHE["timestamp"]) < CACHE_TTL:
            return _FILTER_CACHE["data"]

        # Companies and Locations from scraped data
        query = f"""
            SELECT DISTINCT company FROM {DB_SCHEMA}.active_scraped_data WHERE company IS NOT NULL
            UNION
            SELECT DISTINCT company FROM {DB_SCHEMA}.inactive_scraped_data WHERE company IS NOT NULL
        """
        companies = [r[0] for r in self.session.execute(text(query)).fetchall() if r[0]]

        query = f"""
            SELECT DISTINCT location FROM {DB_SCHEMA}.active_scraped_data WHERE location IS NOT NULL
            UNION
            SELECT DISTINCT location FROM {DB_SCHEMA}.inactive_scraped_data WHERE location IS NOT NULL
        """
        locations = [r[0] for r in self.session.execute(text(query)).fetchall() if r[0]]

        # Vendors ONLY if they have jobs - optimized with EXISTS
        query = f"""
            SELECT DISTINCT vendor_name FROM {DB_SCHEMA}.input_active i
            WHERE EXISTS (SELECT 1 FROM {DB_SCHEMA}.active_scraped_data s WHERE s.keyword = i.dice_search_link)
            UNION
            SELECT DISTINCT vendor_name FROM {DB_SCHEMA}.input_inactive i
            WHERE EXISTS (SELECT 1 FROM {DB_SCHEMA}.inactive_scraped_data s WHERE s.keyword = i.dice_job_link)
        """
        vendors = [r[0] for r in self.session.execute(text(query)).fetchall() if r[0]]

        res = {
            "companies": sorted(list(set(companies))),
            "locations": sorted(list(set(locations))),
            "vendors": sorted(list(set(vendors))),
        }

        _FILTER_CACHE["data"] = res
        _FILTER_CACHE["timestamp"] = now
        return res

    def sync_schema(self):
        """Create tables if they don't exist"""
        with engine.connect() as conn:
            conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {DB_SCHEMA}"))
            conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {CANDIDATE_SCHEMA}"))
            conn.commit()
        Base.metadata.create_all(engine)
        with engine.connect() as conn:
            _migrate_candidate_formatting_data(conn)
            _drop_legacy_candidate_formatting_columns(conn)
            _migrate_checker_columns(conn)
            conn.commit()

    def create_indexes(self):
        """Create necessary indexes for performance if they don't exist"""
        idx_queries = [
            # Active Scraped Data
            f"CREATE INDEX IF NOT EXISTS idx_active_keyword ON {DB_SCHEMA}.active_scraped_data (keyword)",
            f"CREATE INDEX IF NOT EXISTS idx_inactive_keyword ON {DB_SCHEMA}.inactive_scraped_data (keyword)",
            f"CREATE INDEX IF NOT EXISTS idx_input_active_link ON {DB_SCHEMA}.input_active (dice_search_link)",
            f"CREATE INDEX IF NOT EXISTS idx_input_inactive_link ON {DB_SCHEMA}.input_inactive (dice_job_link)",
            f"CREATE INDEX IF NOT EXISTS idx_active_company ON {DB_SCHEMA}.active_scraped_data (company)",
            f"CREATE INDEX IF NOT EXISTS idx_active_location ON {DB_SCHEMA}.active_scraped_data (location)",
            # Inactive Scraped Data
            f"CREATE INDEX IF NOT EXISTS idx_inactive_company ON {DB_SCHEMA}.inactive_scraped_data (company)",
            f"CREATE INDEX IF NOT EXISTS idx_inactive_location ON {DB_SCHEMA}.inactive_scraped_data (location)",
            # Input Tables
            f"CREATE INDEX IF NOT EXISTS idx_input_active_vendor ON {DB_SCHEMA}.input_active (vendor_name)",
            f"CREATE INDEX IF NOT EXISTS idx_input_inactive_vendor ON {DB_SCHEMA}.input_inactive (vendor_name)",
            f"CREATE INDEX IF NOT EXISTS idx_input_inactive_link ON {DB_SCHEMA}.input_inactive (dice_job_link)",
            # Talent and System table indexes
            f'CREATE INDEX IF NOT EXISTS idx_candidate_details_name ON "{CANDIDATE_SCHEMA}"."candidate_basic_info" (first_name, last_name)',
            f"CREATE INDEX IF NOT EXISTS idx_scraper_logs_time ON {DB_SCHEMA}.scraper_logs (start_time DESC)",
        ]

        for q in idx_queries:
            try:
                self.session.execute(text(q))
                self.session.commit()
            except Exception as e:
                self.session.rollback()
                print(f"Index creation warning: {e}")

    def close(self):
        self.session.close()
