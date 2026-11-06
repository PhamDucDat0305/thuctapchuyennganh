/* Run once in SSMS with job_viet selected. Stores VND amounts as whole numbers. */
IF OBJECT_ID(N'dbo.jobs', N'U') IS NULL
    THROW 50015, N'Không tìm thấy dbo.jobs. Hãy chọn đúng database job_viet.', 1;
GO

IF COL_LENGTH(N'dbo.jobs', N'salary_min') IS NULL
    EXEC sys.sp_executesql N'ALTER TABLE dbo.jobs ADD salary_min DECIMAL(18,0) NULL;';
GO

IF COL_LENGTH(N'dbo.jobs', N'salary_max') IS NULL
    EXEC sys.sp_executesql N'ALTER TABLE dbo.jobs ADD salary_max DECIMAL(18,0) NULL;';
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID(N'dbo.jobs') AND name = N'CK_jobs_salary_range')
    EXEC sys.sp_executesql N'ALTER TABLE dbo.jobs ADD CONSTRAINT CK_jobs_salary_range CHECK (salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max);';
GO

SELECT name, TYPE_NAME(system_type_id) AS data_type, precision, scale, is_nullable
FROM sys.columns
WHERE object_id = OBJECT_ID(N'dbo.jobs') AND name IN (N'salary_min', N'salary_max')
ORDER BY name;
GO
