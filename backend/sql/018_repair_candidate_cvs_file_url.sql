/* Ensure dbo.candidate_cvs matches the current API/model storage metadata.
   Existing file_url values are preserved; missing values are rebuilt from stored_name. */
USE [job_viet];
GO

IF OBJECT_ID(N'dbo.candidate_cvs', N'U') IS NULL
BEGIN
    ;THROW 51018, N'dbo.candidate_cvs does not exist. Run candidate CV migrations first.', 1;
END;
GO

IF COL_LENGTH(N'dbo.candidate_cvs', N'file_url') IS NULL
    ALTER TABLE dbo.candidate_cvs ADD file_url NVARCHAR(500) NULL;
GO

UPDATE dbo.candidate_cvs
SET file_url = CONCAT(N'private_uploads/cvs/', stored_name)
WHERE (file_url IS NULL OR LTRIM(RTRIM(file_url)) = N'')
  AND stored_name IS NOT NULL
  AND LTRIM(RTRIM(stored_name)) <> N'';
GO

IF EXISTS (SELECT 1 FROM dbo.candidate_cvs WHERE file_url IS NULL OR LTRIM(RTRIM(file_url)) = N'')
BEGIN
    ;THROW 51019, N'Có CV chưa thể điền file_url; kiểm tra stored_name trước khi chạy lại migration.', 1;
END;
GO

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.candidate_cvs')
      AND name = N'file_url' AND is_nullable = 1
)
    ALTER TABLE dbo.candidate_cvs ALTER COLUMN file_url NVARCHAR(500) NOT NULL;
GO

SELECT name AS column_name, TYPE_NAME(user_type_id) AS data_type, max_length, is_nullable
FROM sys.columns
WHERE object_id = OBJECT_ID(N'dbo.candidate_cvs') AND name = N'file_url';
GO
