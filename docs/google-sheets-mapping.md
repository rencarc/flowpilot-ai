# Google Sheets Mapping For Make

Create a Google Sheet with these columns:

```text
created_at
case_id
case_url
title
requester
department
priority
risk_level
status
workflow_name
approved_by
approved_at
policy_citation_count
policy_summary
missing_information
due_at
access_expires_at
external_status
notes
```

You can import this CSV template:

```text
docs/flowpilot-make-google-sheets-template.csv
```

## Make Mapping

In Make, after `Custom webhook`, add `Google Sheets -> Add a Row`.

Map fields like this:

```text
created_at -> Make current date/time
case_id -> case_id
case_url -> case_url
title -> title
requester -> requester
department -> department
priority -> priority
risk_level -> risk_level
status -> status
workflow_name -> workflow_name
approved_by -> approved_by
approved_at -> approved_at
policy_citation_count -> policy_citation_count
policy_summary -> policy_summary
missing_information -> missing_information
due_at -> due_at
access_expires_at -> access_expires_at
external_status -> received
notes -> FlowPilot approved workflow handoff
```

## Discord Message Template

Use this message in the Make Discord module:

```text
FlowPilot workflow handoff received

Case: {{title}}
Risk: {{risk_level}}
Workflow: {{workflow_name}}
Requester: {{requester}}
Department: {{department}}
Approved by: {{approved_by}}
Policy citations: {{policy_citation_count}}
Case URL: {{case_url}}
```

## Why These Fields Matter

- `case_url` lets the reviewer jump back to FlowPilot.
- `workflow_name` proves the handoff came from an approved template.
- `approved_by` and `approved_at` prove human review happened before execution.
- `policy_citation_count` and `policy_summary` prove RAG evidence was attached.
- `missing_information` shows whether the request was complete at handoff time.

