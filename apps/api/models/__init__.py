"""SQLAlchemy models for all database tables."""

from .ai import AIChatMessage, AIChatSession
from .audit import Audit, RepoScanHistory, RepositoryAnalysis
from .deployment import DeploymentChecklistItem
from .document import (
    DocumentAccessLink,
    DocumentFolder,
    DocumentVersion,
    ExternalDocumentLink,
)
from .enums import AppRole, EnvironmentType, NotificationType, ProjectSourceType
from .evaluation import EngineerEvaluation
from .knowledge import KnowledgeEntry
from .marketing import (
    MarketingChecklistItem,
    MarketingChecklistTemplate,
    MarketingCredential,
    MarketingDomain,
    MarketingSocialHandle,
)
from .notification import Notification
from .product import (
    Product,
    ProductDocument,
    ProductEnvironment,
    ProductLink,
    ProductManagementNote,
    ProductMember,
    ProductNotificationSetting,
    ProductPartnerNote,
)
from .project import ProjectCompletion, ProjectStakeholder
from .qa import QACheck
from .settings import (
    FeaturePermission,
    GlobalIntegration,
    ManagementNoteAccess,
    Module,
    NationalHoliday,
    OrgSetting,
    PermissionAuditLog,
    ProjectIntegration,
    RolePermission,
    StandardsRepository,
    TeamHoliday,
)
from .specification import Specification, SpecificationFeature, SpecificationSource
from .task import Task, TaskTemplate, TaskTemplateGroup
from .checklist_template import (
    ChecklistCategory,
    ChecklistTemplate,
    ChecklistTemplateItem,
    ProjectChecklist,
    ProjectChecklistItem,
)
from .task_checklist import TaskChecklistItem
from .task_comment import TaskComment
from .user import (
    InvitationToken,
    PasswordResetToken,
    Profile,
    UserGithubConnection,
    UserNotificationPreference,
    UserPermissionOverride,
    UserRole,
)
from .github_pat import GitHubPat

__all__ = [
    # Enums
    "AppRole",
    "EnvironmentType",
    "NotificationType",
    "ProjectSourceType",
    # AI
    "AIChatSession",
    "AIChatMessage",
    # Audit
    "Audit",
    "RepoScanHistory",
    "RepositoryAnalysis",
    # Deployment
    "DeploymentChecklistItem",
    # Evaluation
    "EngineerEvaluation",
    # Document
    "DocumentFolder",
    "DocumentVersion",
    "DocumentAccessLink",
    "ExternalDocumentLink",
    # Knowledge
    "KnowledgeEntry",
    # Marketing
    "MarketingChecklistItem",
    "MarketingChecklistTemplate",
    "MarketingCredential",
    "MarketingDomain",
    "MarketingSocialHandle",
    # Notification
    "Notification",
    # Product
    "Product",
    "ProductMember",
    "ProductEnvironment",
    "ProductLink",
    "ProductDocument",
    "ProductManagementNote",
    "ProductNotificationSetting",
    "ProductPartnerNote",
    # Project
    "ProjectCompletion",
    "ProjectStakeholder",
    # QA
    "QACheck",
    # Settings
    "Module",
    "FeaturePermission",
    "RolePermission",
    "PermissionAuditLog",
    "StandardsRepository",
    "GlobalIntegration",
    "ProjectIntegration",
    "NationalHoliday",
    "TeamHoliday",
    "ManagementNoteAccess",
    "OrgSetting",
    # Specification
    "Specification",
    "SpecificationFeature",
    "SpecificationSource",
    # Checklist Templates
    "ChecklistTemplate",
    "ChecklistTemplateItem",
    "ProjectChecklist",
    "ProjectChecklistItem",
    "ChecklistCategory",
    # Task
    "Task",
    "TaskChecklistItem",
    "TaskComment",
    "TaskTemplate",
    "TaskTemplateGroup",
    # User
    "Profile",
    "UserRole",
    "UserPermissionOverride",
    "UserNotificationPreference",
    "UserGithubConnection",
    "InvitationToken",
    "PasswordResetToken",
    # GitHub PAT
    "GitHubPat",
]
