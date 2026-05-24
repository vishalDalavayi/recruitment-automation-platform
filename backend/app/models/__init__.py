# Lazy exports for models package
def __getattr__(name):
    if name in ("Base", "engine", "SessionLocal", "DB_SCHEMA", "CANDIDATE_SCHEMA"):
        from app.models import base
        return getattr(base, name)
    
    if name in ("InputActive", "InputInactive", "ActiveDiceJobs", "InactiveDiceJobs", 
               "ActiveScrapedData", "InactiveScrapedData", "ScraperLog"):
        from app.models import jobs
        return getattr(jobs, name)
        
    if name in ("Candidate", "FormattingResumeInfo"):
        from app.models import candidates
        return getattr(candidates, name)
        
    raise AttributeError(f"module '{__name__}' has no attribute '{name}'")
