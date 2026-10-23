/*
  Run once in SSMS against job_viet.
  If dbo.applications already exists, inspect its columns and constraints first;
  the API expects the schema defined below.
*/
IF OBJECT_ID(N'dbo.applications', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.applications (
        id BIGINT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_applications PRIMARY KEY,
        job_id BIGINT NOT NULL,
        candidate_id BIGINT NOT NULL,
        cv_text NVARCHAR(MAX) NOT NULL,
        status NVARCHAR(30) NOT NULL
            CONSTRAINT DF_applications_status DEFAULT (N'applied'),
        applied_at DATETIME2(0) NOT NULL
            CONSTRAINT DF_applications_applied_at DEFAULT (SYSUTCDATETIME()),
        updated_at DATETIME2(0) NOT NULL
            CONSTRAINT DF_applications_updated_at DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT UQ_applications_job_candidate UNIQUE (job_id, candidate_id),
        CONSTRAINT CK_applications_status CHECK
            (status IN (N'applied', N'interview_scheduled', N'accepted', N'rejected', N'failed')),
        CONSTRAINT FK_applications_job FOREIGN KEY (job_id)
            REFERENCES dbo.jobs(id),
        CONSTRAINT FK_applications_candidate FOREIGN KEY (candidate_id)
            REFERENCES dbo.users(id)
    );

    CREATE INDEX IX_applications_candidate_applied
        ON dbo.applications(candidate_id, applied_at DESC);
    CREATE INDEX IX_applications_job_applied
        ON dbo.applications(job_id, applied_at DESC);
    PRINT N'Đã tạo dbo.applications.';
END
ELSE
BEGIN
    PRINT N'dbo.applications đã tồn tại; không thay đổi bảng. Hãy kiểm tra cột và constraint khớp với API.';
END;
GO
