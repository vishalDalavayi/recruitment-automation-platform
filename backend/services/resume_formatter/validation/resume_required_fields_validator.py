from services.resume_formatter.schemas.resume_schema import Academic, Experience, MissingFieldDetail, ResumeContent


def get_missing_required_fields(resume_content: ResumeContent) -> list[str]:
    return [
        path
        for detail in get_missing_required_field_details(resume_content)
        for path in detail.missing_paths
    ]


def get_missing_required_field_details(
    resume_content: ResumeContent,
) -> list[MissingFieldDetail]:
    missing_field_details: list[MissingFieldDetail] = []

    _append_simple_missing_field(
        missing_field_details,
        field_name="Summary",
        message="Provide the professional summary.",
        has_value=_has_text(resume_content.Summary),
    )

    _, academic_detail = _get_academic_missing_details(resume_content.Academics)
    if academic_detail:
        missing_field_details.append(academic_detail)

    _append_simple_missing_field(
        missing_field_details,
        field_name="Technical_Skills",
        message="Provide at least one technical skill category with one or more skills.",
        has_value=_has_skills(resume_content.Technical_Skills),
    )

    _, experience_detail = _get_experience_missing_details(resume_content.Professional_Experience)
    if experience_detail:
        missing_field_details.append(experience_detail)

    return missing_field_details


def get_identity_mismatch_details(
    resume_content: ResumeContent,
    *,
    expected_name: str,
    expected_phone: str,
    expected_email: str,
) -> list[MissingFieldDetail]:
    mismatch_details: list[MissingFieldDetail] = []

    _append_identity_mismatch_detail(
        mismatch_details,
        field_name="Name",
        extracted_value=resume_content.Name,
        expected_value=expected_name,
        field_label="candidate name",
    )
    _append_identity_mismatch_detail(
        mismatch_details,
        field_name="Phone",
        extracted_value=resume_content.Phone,
        expected_value=expected_phone,
        field_label="phone number",
    )
    _append_identity_mismatch_detail(
        mismatch_details,
        field_name="Email",
        extracted_value=resume_content.Email,
        expected_value=expected_email,
        field_label="email address",
    )

    return mismatch_details


def validate_required_fields(resume_content: ResumeContent) -> None:
    missing_fields = get_missing_required_fields(resume_content)
    if missing_fields:
        raise ValueError(f"Missing required fields: {', '.join(missing_fields)}")


def _append_simple_missing_field(
    missing_field_details: list[MissingFieldDetail],
    *,
    field_name: str,
    message: str,
    has_value: bool,
) -> None:
    if has_value:
        return

    missing_field_details.append(
        MissingFieldDetail(
            field=field_name,
            missing_paths=[field_name],
            message=message,
        )
    )


def _append_identity_mismatch_detail(
    mismatch_details: list[MissingFieldDetail],
    *,
    field_name: str,
    extracted_value: str,
    expected_value: str,
    field_label: str,
) -> None:
    expected_text = expected_value.strip() if expected_value else ""
    if not expected_text:
        return

    extracted_text = extracted_value.strip() if extracted_value else ""
    if extracted_text == expected_text:
        return

    extracted_display = extracted_text or "not found in resume"
    expected_display = expected_text
    mismatch_details.append(
        MissingFieldDetail(
            field=field_name,
            missing_paths=[field_name],
            message=(
                f"Resume {field_label}: {extracted_display}. "
                f"Candidate profile {field_label}: {expected_display}. "
                f"Confirm the correct {field_label} for the formatted resume."
            ),
        )
    )


def _get_academic_missing_details(
    academics: list[Academic],
) -> tuple[list[str], MissingFieldDetail | None]:
    required_subfields = ("Degree", "Major", "University")

    if not academics:
        missing_paths = [f"Academics[0].{subfield}" for subfield in required_subfields]
        return (
            missing_paths,
            MissingFieldDetail(
                field="Academics",
                missing_paths=missing_paths,
                message="Provide at least one academic entry with Degree, Major, and University.",
            ),
        )

    incomplete_paths_by_entry: list[list[str]] = []
    for index, academic in enumerate(academics):
        entry_missing_paths = [
            f"Academics[{index}].{subfield}"
            for subfield in required_subfields
            if not _has_text(getattr(academic, subfield))
        ]
        if entry_missing_paths:
            incomplete_paths_by_entry.append(entry_missing_paths)

    if not incomplete_paths_by_entry:
        return [], None

    return (
        min(incomplete_paths_by_entry, key=len),
        MissingFieldDetail(
            field="Academics",
            missing_paths=[path for paths in incomplete_paths_by_entry for path in paths],
            message="Every academic entry must include Degree, Major, and University.",
        ),
    )


def _get_experience_missing_details(
    experiences: list[Experience],
) -> tuple[list[str], MissingFieldDetail | None]:
    required_subfields = (
        "Company",
        "location",
        "title",
        "dates_of_employment",
        "project_description",
        "Responsibilities",
        "Environment",
    )

    if not experiences:
        missing_paths = [f"Professional_Experience[0].{subfield}" for subfield in required_subfields]
        return (
            missing_paths,
            MissingFieldDetail(
                field="Professional_Experience",
                missing_paths=missing_paths,
                message=(
                    "Provide at least one professional experience entry with Company, location, "
                    "title, dates_of_employment, project_description, Responsibilities, and Environment."
                ),
            ),
        )

    incomplete_paths_by_entry: list[list[str]] = []
    for index, experience in enumerate(experiences):
        entry_missing_paths = [
            f"Professional_Experience[{index}].{subfield}"
            for subfield in required_subfields
            if not _has_entry_value(getattr(experience, subfield))
        ]
        if entry_missing_paths:
            incomplete_paths_by_entry.append(entry_missing_paths)

    if not incomplete_paths_by_entry:
        return [], None

    return (
        min(incomplete_paths_by_entry, key=len),
        MissingFieldDetail(
            field="Professional_Experience",
            missing_paths=[path for paths in incomplete_paths_by_entry for path in paths],
            message=(
                "Every professional experience entry must include Company, location, title, "
                "dates_of_employment, project_description, Responsibilities, and Environment."
            ),
        ),
    )


def _has_skills(skills: dict[str, list[str]]) -> bool:
    return any(_has_text(skill) for values in skills.values() for skill in values)


def _has_text(value: str) -> bool:
    return bool(value and value.strip())


def _has_entry_value(value: str | list[str]) -> bool:
    if isinstance(value, list):
        return any(_has_text(item) for item in value)
    return _has_text(value)
