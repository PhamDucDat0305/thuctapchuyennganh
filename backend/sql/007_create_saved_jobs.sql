/* Run once in SSMS with job_viet selected. */
IF OBJECT_ID(N'dbo.users', N'U') IS NULL OR OBJECT_ID(N'dbo.jobs', N'U') IS NULL
    THROW 50007, N'Không tìm thấy dbo.users hoặc dbo.jobs. Hãy chọn đúng database job_viet.', 1;
GO

IF OBJECT_ID(N'dbo.saved_jobs', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.saved_jobs (
        candidate_id BIGINT NOT NULL,
        job_id BIGINT NOT NULL,
        saved_at DATETIME2(0) NOT NULL
            CONSTRAINT DF_saved_jobs_saved_at DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_saved_jobs PRIMARY KEY (candidate_id, job_id),
        CONSTRAINT FK_saved_jobs_candidate FOREIGN KEY (candidate_id)
            REFERENCES dbo.users(id),
        CONSTRAINT FK_saved_jobs_job FOREIGN KEY (job_id)
            REFERENCES dbo.jobs(id)
    );
    CREATE INDEX IX_saved_jobs_job ON dbo.saved_jobs(job_id, candidate_id);
    PRINT N'Đã tạo dbo.saved_jobs.';
END
ELSE
    PRINT N'dbo.saved_jobs đã tồn tại; không thay đổi.';
GO

SELECT c.name AS column_name, TYPE_NAME(c.user_type_id) AS data_type
FROM sys.columns AS c
WHERE c.object_id = OBJECT_ID(N'dbo.saved_jobs')
ORDER BY c.column_id;
GO
