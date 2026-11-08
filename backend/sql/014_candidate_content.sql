/* Candidate CV/cover-letter records and employer saved-candidate list. */
USE [job_viet];
GO

IF OBJECT_ID(N'dbo.users', N'U') IS NULL
   OR OBJECT_ID(N'dbo.applications', N'U') IS NULL
   OR OBJECT_ID(N'dbo.jobs', N'U') IS NULL
    THROW 51014, N'Requires dbo.users, dbo.jobs and dbo.applications.', 1;
GO

IF OBJECT_ID(N'dbo.employer_saved_candidates', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.employer_saved_candidates (
        employer_id BIGINT NOT NULL,
        candidate_id BIGINT NOT NULL,
        saved_at DATETIME2(0) NOT NULL CONSTRAINT DF_employer_saved_candidates_saved_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_employer_saved_candidates PRIMARY KEY (employer_id, candidate_id),
        CONSTRAINT CK_employer_saved_candidates_distinct CHECK (employer_id <> candidate_id),
        CONSTRAINT FK_employer_saved_candidates_employer FOREIGN KEY (employer_id) REFERENCES dbo.users(id),
        CONSTRAINT FK_employer_saved_candidates_candidate FOREIGN KEY (candidate_id) REFERENCES dbo.users(id)
    );
    CREATE INDEX IX_employer_saved_candidates_candidate ON dbo.employer_saved_candidates(candidate_id, saved_at DESC);
END;
GO

IF OBJECT_ID(N'dbo.candidate_cvs', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.candidate_cvs (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_candidate_cvs PRIMARY KEY,
        candidate_id BIGINT NOT NULL,
        title NVARCHAR(150) NOT NULL,
        original_name NVARCHAR(255) NOT NULL,
        stored_name NVARCHAR(100) NOT NULL,
        mime_type NVARCHAR(100) NOT NULL,
        size_bytes INT NOT NULL,
        is_default BIT NOT NULL CONSTRAINT DF_candidate_cvs_is_default DEFAULT (0),
        created_at DATETIME2(0) NOT NULL CONSTRAINT DF_candidate_cvs_created_at DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_candidate_cvs_updated_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_candidate_cvs_size CHECK (size_bytes BETWEEN 1 AND 10485760),
        CONSTRAINT FK_candidate_cvs_candidate FOREIGN KEY (candidate_id) REFERENCES dbo.users(id)
    );
    CREATE INDEX IX_candidate_cvs_owner_created ON dbo.candidate_cvs(candidate_id, created_at DESC, id DESC);
    CREATE UNIQUE INDEX UX_candidate_cvs_one_default ON dbo.candidate_cvs(candidate_id) WHERE is_default = 1;
END;
GO

IF OBJECT_ID(N'dbo.cover_letters', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.cover_letters (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_cover_letters PRIMARY KEY,
        candidate_id BIGINT NOT NULL,
        title NVARCHAR(150) NOT NULL,
        content NVARCHAR(MAX) NOT NULL,
        created_at DATETIME2(0) NOT NULL CONSTRAINT DF_cover_letters_created_at DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_cover_letters_updated_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_cover_letters_content CHECK (LEN(LTRIM(RTRIM(content))) > 0),
        CONSTRAINT FK_cover_letters_candidate FOREIGN KEY (candidate_id) REFERENCES dbo.users(id)
    );
    CREATE INDEX IX_cover_letters_owner_updated ON dbo.cover_letters(candidate_id, updated_at DESC, id DESC);
END;
GO

IF COL_LENGTH(N'dbo.applications', N'cv_id') IS NULL
    ALTER TABLE dbo.applications ADD cv_id BIGINT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE parent_object_id = OBJECT_ID(N'dbo.candidate_cvs') AND name = N'UQ_candidate_cvs_candidate_id_id')
    ALTER TABLE dbo.candidate_cvs ADD CONSTRAINT UQ_candidate_cvs_candidate_id_id UNIQUE (candidate_id, id);
GO

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.applications') AND name = N'FK_applications_cv')
    ALTER TABLE dbo.applications DROP CONSTRAINT FK_applications_cv;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.applications') AND name = N'FK_applications_candidate_cv')
    ALTER TABLE dbo.applications ADD CONSTRAINT FK_applications_candidate_cv
      FOREIGN KEY (candidate_id, cv_id) REFERENCES dbo.candidate_cvs(candidate_id, id);
GO

/* A file-only application is valid; existing CV text is retained unchanged. */
IF COL_LENGTH(N'dbo.applications', N'cv_text') IS NULL
BEGIN
    ;THROW 51015, N'dbo.applications.cv_text is required by the current API.', 1;
END;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.applications') AND name = N'cv_text' AND is_nullable = 0)
    ALTER TABLE dbo.applications ALTER COLUMN cv_text NVARCHAR(MAX) NULL;
GO

IF OBJECT_ID(N'dbo.invites', N'U') IS NOT NULL
BEGIN
    IF EXISTS (
        SELECT employer_id, candidate_id, job_id FROM dbo.invites
        WHERE status = N'pending' AND job_id IS NOT NULL
        GROUP BY employer_id, candidate_id, job_id HAVING COUNT_BIG(*) > 1
    ) OR EXISTS (
        SELECT employer_id, candidate_id FROM dbo.invites
        WHERE status = N'pending' AND job_id IS NULL
        GROUP BY employer_id, candidate_id HAVING COUNT_BIG(*) > 1
    )
    BEGIN
        ;THROW 51016, N'Có lời mời pending trùng; xử lý bản ghi trùng trong dbo.invites trước khi thêm ràng buộc duy nhất.', 1;
    END;

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.invites') AND name = N'UX_invites_pending_job')
        CREATE UNIQUE INDEX UX_invites_pending_job ON dbo.invites(employer_id, candidate_id, job_id)
        WHERE status = N'pending' AND job_id IS NOT NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.invites') AND name = N'UX_invites_pending_no_job')
        CREATE UNIQUE INDEX UX_invites_pending_no_job ON dbo.invites(employer_id, candidate_id)
        WHERE status = N'pending' AND job_id IS NULL;
END;
GO

SELECT N'employer_saved_candidates' AS table_name, COUNT(*) AS columns_count FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.employer_saved_candidates')
UNION ALL SELECT N'candidate_cvs', COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.candidate_cvs')
UNION ALL SELECT N'cover_letters', COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.cover_letters');
GO
