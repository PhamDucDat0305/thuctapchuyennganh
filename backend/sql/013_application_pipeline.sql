/* Upgrade application pipeline and keep interview workflow independent. Run in SSMS. */
USE [job_viet];
GO

IF OBJECT_ID(N'dbo.applications', N'U') IS NULL OR OBJECT_ID(N'dbo.interviews', N'U') IS NULL
BEGIN
    ;THROW 51000, N'Requires dbo.applications and dbo.interviews to exist first.', 1;
END;
GO

DECLARE @dropChecks NVARCHAR(MAX) = N'';
SELECT @dropChecks += N'ALTER TABLE dbo.applications DROP CONSTRAINT ' + QUOTENAME(cc.name) + N';'
FROM sys.check_constraints cc
WHERE cc.parent_object_id = OBJECT_ID(N'dbo.applications')
  AND cc.definition LIKE N'%status%';
IF @dropChecks <> N'' EXEC sys.sp_executesql @dropChecks;
GO

UPDATE dbo.applications
SET status = CASE status
    WHEN N'interview_scheduled' THEN N'interview_invited'
    WHEN N'pending' THEN N'applied'
    ELSE status
END;
GO

ALTER TABLE dbo.applications WITH CHECK ADD CONSTRAINT CK_applications_pipeline_status
CHECK (status IN (
    N'applied', N'reviewing', N'interview_invited', N'interviewed', N'offered',
    N'offer_accepted', N'offer_declined', N'hired', N'employment_ended', N'rejected', N'withdrawn',
    N'accepted', N'failed'
));
GO

IF COL_LENGTH(N'dbo.interviews', N'status') IS NULL
    ALTER TABLE dbo.interviews ADD status NVARCHAR(30) NOT NULL
        CONSTRAINT DF_interviews_status DEFAULT (N'scheduled') WITH VALUES;
GO

DECLARE @dropInterviewChecks NVARCHAR(MAX) = N'';
SELECT @dropInterviewChecks += N'ALTER TABLE dbo.interviews DROP CONSTRAINT ' + QUOTENAME(cc.name) + N';'
FROM sys.check_constraints cc
WHERE cc.parent_object_id = OBJECT_ID(N'dbo.interviews')
  AND cc.definition LIKE N'%status%';
IF @dropInterviewChecks <> N'' EXEC sys.sp_executesql @dropInterviewChecks;
GO

UPDATE dbo.interviews
SET status = N'scheduled'
WHERE status = N'reschedule_requested';
GO

ALTER TABLE dbo.interviews WITH CHECK ADD CONSTRAINT CK_interviews_workflow_status
CHECK (status IN (N'scheduled', N'confirmed', N'declined', N'completed', N'canceled', N'no_show'));
GO
