# Dice Scraper Database Guide (PostgreSQL)

This document provides a detailed overview of the PostgreSQL database schema used by the Dice Scraper application.

## Connection Summary

- **Host**: Provided in `.env` (`DB_HOST`)
- **Port**: 5432
- **Database**: `resume_intelligence`
- **Schema**: `scrapped_data`
- **Driver**: SQLAlchemy with `psycopg2`

---

## 1. Input Tables

These tables store search links and vendor names.

### `input_active`
| Column               | Type       | Description                         |
| :------------------- | :--------- | :---------------------------------- |
| `serial_no`        | `SERIAL` | Primary Key.                        |
| `vendor_name`      | `TEXT`   | Name of the agency/vendor.          |
| `dice_search_link` | `TEXT`   | The search URL to be scanned.       |

---

## 2. Scraped Data Tables

### `active_scraped_data` & `inactive_scraped_data`
| Column                  | Type          | Description                                    |
| :---------------------- | :------------ | :--------------------------------------------- |
| `serial_no`           | `SERIAL`    | Primary Key.                                   |
| `title`               | `TEXT`      | Job title.                                     |
| `company`             | `TEXT`      | Hiring company.                                |
| `location`            | `TEXT`      | City/State.                                    |
| `posted_date`         | `TEXT`      | Date of posting.                               |
| `job_type`            | `TEXT`      | Contract/Full-time.                            |
| `description`         | `TEXT`      | Full job description.                          |
| `url`                 | `TEXT`      | Unique Dice job URL.                           |
| `scraped_at`          | `TIMESTAMP` | Record insertion time.                         |

---

## 3. Talent Management

### `candidates`
Stores registered human talent and their professional portfolios.

| Column             | Type        | Description                                     |
| :----------------- | :---------- | :---------------------------------------------- |
| `serial_no`      | `SERIAL`    | Primary Key.                                    |
| `full_name`      | `TEXT`      | Candidate's legal name.                         |
| `email`          | `VARCHAR`   | Primary contact (Unique Constraint).            |
| `phone`          | `VARCHAR`   | Contact number with country code.               |
| `resume_url`     | `TEXT`      | URL to Azure Blob (Signed with SAS).            |
| `skills`         | `TEXT`      | Extracted skill keywords.                       |
| `experience_years`| `INTEGER`   | Years of relevant professional experience.      |
| `current_title`  | `TEXT`      | Current or targeted job title.                  |
| `added_at`       | `TIMESTAMP` | Registration timestamp.                         |

---

## 4. System & Monitoring

### `scraper_logs`
Tracks every execution of the automation engine.

| Column            | Type        | Description                                     |
| :---------------- | :---------- | :---------------------------------------------- |
| `serial_no`     | `SERIAL`    | Primary Key.                                    |
| `start_time`    | `TIMESTAMP` | Start of execution.                             |
| `end_time`      | `TIMESTAMP` | Completion of execution.                        |
| `status`        | `VARCHAR`   | `completed`, `failed`, or `stopped`.            |
| `total_count`   | `INTEGER`   | Total records processed.                         |
| `config_snapshot`| `JSON`      | Snapshot of scraper settings during the run.    |

---

## Management Tips

- **Primary Key**: All tables use `serial_no` for robust conflict resolution.
- **SAS Signatures**: Candidate `resume_url` entries are automatically appended with a Shared Access Signature (SAS) token if the storage account is private. These tokens allow temporary public viewing (7 days for SPN auth, 1 year for Account Key auth).
- **Clearing Data**: Use the dashboard's "Preferences" tab for Irreversible Action safety-locked data purging.
