"""
Job-related ORM Models
=======================
"""

from sqlalchemy import Column, Integer, Text, String, DateTime, JSON, Index
from datetime import datetime
from app.models.base import Base


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
    duration = Column(Integer)
    active_count = Column(Integer)
    inactive_count = Column(Integer)
    total_count = Column(Integer)
    status = Column(String(50))
    error = Column(Text)
    config_snapshot = Column(JSON)
    triggered_by = Column(String(50))
