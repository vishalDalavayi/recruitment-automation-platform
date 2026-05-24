from datetime import datetime
from typing import Dict, List, Literal

from pydantic import BaseModel, Field


class Academic(BaseModel):
    Degree: str = ""
    Major: str = ""
    University: str = ""


class Experience(BaseModel):
    Company: str = ""
    location: str = ""
    title: str = ""
    dates_of_employment: str = ""
    project_description: str = ""
    Responsibilities: List[str] = Field(default_factory=list)
    Environment: List[str] = Field(default_factory=list)


class AcademicProject(BaseModel):
    project_name: str = ""
    your_title: str = ""
    project_responsibilities: List[str] = Field(default_factory=list)
    Technologies_used: List[str] = Field(default_factory=list)


class ResumeContent(BaseModel):
    Name: str = ""
    Phone: str = ""
    Email: str = ""
    Summary: str = ""
    Academics: List[Academic] = Field(default_factory=list)
    Technical_Skills: Dict[str, List[str]] = Field(default_factory=dict)
    Professional_Experience: List[Experience] = Field(default_factory=list)
    Academic_projects: List[AcademicProject] = Field(default_factory=list)
    certifications: List[str] = Field(default_factory=list)


class MissingFieldDetail(BaseModel):
    field: str
    missing_paths: List[str] = Field(default_factory=list)
    message: str = ""


class LLMAttemptInfo(BaseModel):
    attempt: str = ""
    provider: str = ""
    model: str = ""
    status: Literal["succeeded", "failed"] = "failed"
    error_type: str = ""
    error_message: str = ""
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0


class LLMInfo(BaseModel):
    selected_attempt: str = ""
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_tokens: int = 0
    attempts: List[LLMAttemptInfo] = Field(default_factory=list)


class ResumeDocument(BaseModel):
    file_name: str
    file_type: str
    llm_info: LLMInfo = Field(default_factory=LLMInfo)
    processed_at: datetime
    status: Literal["completed", "needs_input"] = "completed"
    missing_field_details: List[MissingFieldDetail] = Field(default_factory=list)
    resume_content: ResumeContent
    generated_resume_file_name: str = ""
    generated_resume_path: str = ""


class ResumeExtractionResponse(BaseModel):
    record_id: str
    file_name: str
    file_type: str
    llm_info: LLMInfo = Field(default_factory=LLMInfo)
    processed_at: datetime
    status: Literal["completed", "needs_input"] = "completed"
    missing_field_details: List[MissingFieldDetail] = Field(default_factory=list)
    resume_content: ResumeContent
    generated_resume_file_name: str = ""
    generated_resume_path: str = ""


class ResumeContentUpdate(BaseModel):
    Name: str | None = None
    Phone: str | None = None
    Email: str | None = None
    Summary: str | None = None
    Academics: List[Academic] | None = None
    Technical_Skills: Dict[str, List[str]] | None = None
    Professional_Experience: List[Experience] | None = None
    Academic_projects: List[AcademicProject] | None = None
    certifications: List[str] | None = None
