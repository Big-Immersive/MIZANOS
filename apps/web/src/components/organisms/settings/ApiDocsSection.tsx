"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/atoms/display/Card";
import { BaseButton } from "@/components/atoms/buttons/BaseButton";
import { BookOpen, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { toast } from "sonner";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4006";

const DOCS_TEXT = `# Mizan OS API Documentation

## Authentication
Pass your API key via one of these headers:
- X-API-Key: mizan_key_your_key_here
- Authorization: Bearer mizan_key_your_key_here

## Base URL
${API_BASE}

## Endpoints

### List Projects (to find your product_id)
GET /products
Returns all projects with their IDs and names.

### List Tasks
GET /tasks?product_id={uuid}&task_type=task
GET /tasks?product_id={uuid}&task_type=bug

### Create Task
POST /tasks
Body: {
  "product_id": "uuid (required)",
  "title": "Task title (required)",
  "task_type": "task",
  "status": "backlog",
  "priority": "medium",
  "pillar": "development",
  "description": "Optional description",
  "due_date": "2026-04-15",
  "assignee_id": "profile uuid (optional)",
  "milestone_id": "milestone uuid (optional)"
}

### Create Bug
POST /tasks
Body: {
  "product_id": "uuid (required)",
  "title": "Bug title (required)",
  "task_type": "bug",
  "status": "reported",
  "priority": "high",
  "description": "Bug description"
}

### Update Task / Bug
PATCH /tasks/{task_id}
Body: any fields to update, e.g.
{ "status": "in_progress" }
{ "title": "Updated title", "priority": "high" }
{ "assignee_id": "profile-uuid" }

### Get Single Task
GET /tasks/{task_id}

### Delete Task
DELETE /tasks/{task_id}

### List Milestones
GET /products/{product_id}/milestones

### Create Milestone
POST /products/{product_id}/milestones
Body: {
  "title": "Milestone title (required)",
  "description": "Optional description",
  "status": "backlog",
  "priority": "medium",
  "pillar": "development",
  "assignee_id": "profile uuid (optional)"
}

### Update Milestone
PATCH /products/milestones/{milestone_id}
Body: any fields to update

### Delete Milestone
DELETE /products/milestones/{milestone_id}

### List Team Members (to find assignee_id / profile_id)
GET /products/{product_id}/members

### Add Member to Project (superadmin/PM only)
POST /products/{product_id}/members
Body: {
  "profile_id": "uuid of the user to add",
  "role": "ai_engineer | project_manager | business_owner | marketing"
}

### Remove Member from Project
DELETE /products/{product_id}/members/{member_id}

### List All Members Across Projects (to find profile_id)
GET /products/all-members

## Task Statuses
- backlog, in_progress, review, done, live, cancelled

## Bug Statuses
- reported, triaging, in_progress, fixed, verified, reopened, wont_fix, live

## Priorities
- low, medium, high, critical, production_bug

## Pillars / Verticals
- development, product, business, marketing

## Example: List all projects (to find product_id)
curl ${API_BASE}/products \\
  -H "X-API-Key: mizan_key_your_key"

## Example: Create a task via curl
curl -X POST ${API_BASE}/tasks \\
  -H "X-API-Key: mizan_key_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"product_id":"your-project-uuid","title":"My new task","task_type":"task","priority":"medium"}'

## Example: Update task status
curl -X PATCH ${API_BASE}/tasks/task-uuid \\
  -H "X-API-Key: mizan_key_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"status":"in_progress"}'

## Example: Add member to project (superadmin/PM)
curl -X POST ${API_BASE}/products/project-uuid/members \\
  -H "X-API-Key: mizan_key_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"profile_id":"user-profile-uuid","role":"ai_engineer"}'

## Project Member Roles
- ai_engineer, project_manager, business_owner, marketing

## Example: Create a bug
curl -X POST ${API_BASE}/tasks \\
  -H "X-API-Key: mizan_key_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"product_id":"your-project-uuid","title":"Login page broken","task_type":"bug","priority":"critical"}'
`;

export function ApiDocsSection() {
  const [expanded, setExpanded] = useState(false);

  const handleCopyDocs = () => {
    navigator.clipboard.writeText(DOCS_TEXT);
    toast.success("Documentation copied to clipboard");
  };

  return (
    <Card className="border-dashed">
      <CardContent className="p-0">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between p-3 hover:bg-accent/30 transition-colors rounded-lg"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <BookOpen className="h-4 w-4 text-primary" />
            API Documentation
          </span>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {expanded && (
          <div className="px-3 pb-3 space-y-2">
            <div className="flex justify-end">
              <BaseButton variant="outline" size="sm" className="text-xs h-7" onClick={handleCopyDocs}>
                <Copy className="h-3 w-3 mr-1" /> Copy Full Docs
              </BaseButton>
            </div>
            <pre className="text-xs font-mono text-muted-foreground bg-secondary/50 rounded-md p-3 overflow-x-auto whitespace-pre-wrap max-h-[400px] overflow-y-auto">
              {DOCS_TEXT}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
