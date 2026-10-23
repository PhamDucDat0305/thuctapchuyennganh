/*
  Upgrade an existing dbo.applications table for the current API.
  Run once in SSMS with job_viet selected. This does not alter existing rows
  or remove any legacy columns.
*/
IF OBJECT_ID(N'dbo.applications', N'U') IS NULL
    THROW 50001, N'Không tìm thấy dbo.applications trong database hiện tại. Hãy chọn đúng database job_viet.', 1;
GO

IF COL_LENGTH(N'dbo.applications', N'cv_text') IS NULL
BEGIN
    ALTER TABLE dbo.applications ADD cv_text NVARCHAR(MAX) NULL;
    PRINT N'Đã thêm dbo.applications.cv_text.';
END
ELSE
BEGIN
    PRINT N'dbo.applications.cv_text đã tồn tại; không thay đổi.';
END;
GO

/* Preserve old free-text application notes when the previous schema used
   the common cover_letter column name. Dynamic SQL avoids compile-time errors
   when that legacy column is absent. */
IF COL_LENGTH(N'dbo.applications', N'cover_letter') IS NOT NULL
BEGIN
    EXEC sys.sp_executesql N'
        UPDATE dbo.applications
        SET cv_text = TRY_CONVERT(NVARCHAR(MAX), cover_letter)
        WHERE cv_text IS NULL AND cover_letter IS NOT NULL;';
    PRINT N'Đã sao chép nội dung cover_letter cũ sang cv_text (nếu có).';
END;
GO

SELECT COL_LENGTH(N'dbo.applications', N'cv_text') AS cv_text_max_length;
GO
