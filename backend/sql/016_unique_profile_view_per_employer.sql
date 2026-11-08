/* Count at most one profile view per employer/candidate pair. Run in job_viet. */
USE [job_viet];
GO

IF OBJECT_ID(N'dbo.profile_views', N'U') IS NULL
BEGIN
    ;THROW 51018, N'dbo.profile_views does not exist. Run migration 011 first.', 1;
END;
GO

SET XACT_ABORT ON;
BEGIN TRY
    BEGIN TRANSACTION;

    /* Keep the latest historical view for each pair before enforcing uniqueness. */
    ;WITH RankedViews AS (
        SELECT id,
            ROW_NUMBER() OVER (
                PARTITION BY employer_id, candidate_id
                ORDER BY viewed_at DESC, id DESC
            ) AS row_number
        FROM dbo.profile_views WITH (TABLOCKX, HOLDLOCK)
    )
    DELETE FROM RankedViews WHERE row_number > 1;

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.profile_views')
          AND name = N'UX_profile_views_employer_candidate'
    )
        CREATE UNIQUE INDEX UX_profile_views_employer_candidate
            ON dbo.profile_views(employer_id, candidate_id);

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO

SELECT employer_id, candidate_id, COUNT(*) AS view_count
FROM dbo.profile_views
GROUP BY employer_id, candidate_id
HAVING COUNT(*) > 1;
GO
