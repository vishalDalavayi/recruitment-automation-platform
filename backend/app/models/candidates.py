"""
Candidate ORM Models
=====================
"""

import os
from sqlalchemy import Column, Integer, String, Text, CHAR, Numeric, DateTime, JSON, ForeignKey, func
from sqlalchemy.orm import relationship
from app.models.base import Base, CANDIDATE_SCHEMA


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
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

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
            f"{CANDIDATE_SCHEMA}.candidate_basic_info.unique_id",
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
