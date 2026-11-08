/* Repair legacy dbo.candidate_cvs tables created before migration 014.
   Run in SSMS against job_viet after migration 014 (safe to run repeatedly). */
USE [job_viet];
GO

IF OBJECT_ID(N'dbo.candidate_cvs', N'U') IS NULL
BEGIN
    ;THROW 51017, N'dbo.candidate_cvs does not exist. Run migration 014_candidate_content.sql first.', 1;
END;
GO

IF COL_LENGTH(N'dbo.candidate_cvs', N'original_name') IS NULL
    ALTER TABLE dbo.candidate_cvs ADD original_name NVARCHAR(255) NULL;
GO

IF COL_LENGTH(N'dbo.candidate_cvs', N'stored_name') IS NULL
    ALTER TABLE dbo.candidate_cvs ADD stored_name NVARCHAR(100) NULL;
GO

IF COL_LENGTH(N'dbo.candidate_cvs', N'mime_type') IS NULL
    ALTER TABLE dbo.candidate_cvs ADD mime_type NVARCHAR(100) NULL;
GO

IF COL_LENGTH(N'dbo.candidate_cvs', N'size_bytes') IS NULL
    ALTER TABLE dbo.candidate_cvs ADD size_bytes INT NULL;
GO

IF COL_LENGTH(N'dbo.candidate_cvs', N'is_default') IS NULL
    ALTER TABLE dbo.candidate_cvs ADD is_default BIT NOT NULL
        CONSTRAINT DF_candidate_cvs_is_default_repair DEFAULT (0) WITH VALUES;
GO

IF COL_LENGTH(N'dbo.candidate_cvs', N'created_at') IS NULL
    ALTER TABLE dbo.candidate_cvs ADD created_at DATETIME2(0) NOT NULL
        CONSTRAINT DF_candidate_cvs_created_at_repair DEFAULT SYSUTCDATETIME() WITH VALUES;
GO

IF COL_LENGTH(N'dbo.candidate_cvs', N'updated_at') IS NULL
    ALTER TABLE dbo.candidate_cvs ADD updated_at DATETIME2(0) NOT NULL
        CONSTRAINT DF_candidate_cvs_updated_at_repair DEFAULT SYSUTCDATETIME() WITH VALUES;
GO

/* Keep existing metadata when possible; records without file metadata are
   marked as legacy placeholders. They are not actual downloadable uploads. */
IF COL_LENGTH(N'dbo.candidate_cvs', N'title') IS NOT NULL
    EXEC(N'UPDATE dbo.candidate_cvs
          SET original_name = LEFT(COALESCE(NULLIF(LTRIM(RTRIM(title)), N''''), CONCAT(N''CV-'', id)), 255)
          WHERE original_name IS NULL OR LTRIM(RTRIM(original_name)) = N'''';');
ELSE
    UPDATE dbo.candidate_cvs
    SET original_name = LEFT(CONCAT(N'CV-', id), 255)
    WHERE original_name IS NULL OR LTRIM(RTRIM(original_name)) = N'';
GO

UPDATE dbo.candidate_cvs
SET stored_name = CONCAT(N'legacy-missing-', id, N'.bin')
WHERE stored_name IS NULL OR LTRIM(RTRIM(stored_name)) = N'';
GO

UPDATE dbo.candidate_cvs
SET mime_type = N'application/octet-stream'
WHERE mime_type IS NULL OR LTRIM(RTRIM(mime_type)) = N'';
GO

UPDATE dbo.candidate_cvs
SET size_bytes = 0
WHERE size_bytes IS NULL OR size_bytes < 0;
GO

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.candidate_cvs')
      AND name = N'stored_name' AND is_nullable = 1
)
    ALTER TABLE dbo.candidate_cvs ALTER COLUMN stored_name NVARCHAR(100) NOT NULL;
GO

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.candidate_cvs')
      AND name = N'mime_type' AND is_nullable = 1
)
    ALTER TABLE dbo.candidate_cvs ALTER COLUMN mime_type NVARCHAR(100) NOT NULL;
GO

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.candidate_cvs')
      AND name = N'size_bytes' AND is_nullable = 1
)
    ALTER TABLE dbo.candidate_cvs ALTER COLUMN size_bytes INT NOT NULL;
GO

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.candidate_cvs')
      AND name = N'original_name' AND is_nullable = 1
)
    ALTER TABLE dbo.candidate_cvs ALTER COLUMN original_name NVARCHAR(255) NOT NULL;
GO

SELECT c.name AS column_name, TYPE_NAME(c.user_type_id) AS data_type,
       c.max_length, c.is_nullable
FROM sys.columns AS c
WHERE c.object_id = OBJECT_ID(N'dbo.candidate_cvs')
ORDER BY c.column_id;
GO
