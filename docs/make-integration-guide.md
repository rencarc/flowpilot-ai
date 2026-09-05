# Make Integration Guide

## What Make Adds

Make is the external automation layer in this demo.

FlowPilot decides whether a request is safe to hand off. Make performs the downstream automation after FlowPilot approval.

```text
FlowPilot AI
-> approved workflow run
-> Make webhook
-> downstream business action
```

This proves that FlowPilot is not only an AI case screen. It can hand off approved work to another business system.

## Why Google Sheets Was Suggested

Google Sheets is not required.

It was suggested because it is the simplest visible external system for a demo:

- easy to connect in Make
- easy to see whether a row was created
- no custom backend needed
- good for interview screenshots
- shows that FlowPilot sent real structured data outside the app

In a real company, this target could be Jira, ServiceNow, Power Automate, Slack, email, HRIS, IAM, procurement, or an internal API.

For this project, Google Sheets is only a demo destination.

## Recommended Minimal Demo

Use this:

```text
FlowPilot -> Make custom webhook -> Google Sheets row
```

Optional:

```text
FlowPilot -> Make custom webhook -> Google Sheets row -> Discord notification
```

Do not add OAuth-heavy tools right now. The goal is to prove the connector architecture, not build a full enterprise integration suite.

## What Data FlowPilot Sends

When an approved workflow run is executed, FlowPilot sends a JSON payload like:

```json
{
  "case_id": "77248e33-6214-401c-a65a-8dd4f6f1b448",
  "title": "Payroll admin access request",
  "requester": "zhen xu",
  "department": "HR",
  "risk_level": "high",
  "policy_citations": [],
  "schema": {}
}
```

Make receives this payload and maps fields into the next action, such as adding a spreadsheet row or sending a notification.

## Make Setup Steps

1. Open Make.
2. Create a new scenario.
3. Add `Webhooks -> Custom webhook`.
4. Name it `FlowPilot Workflow Handoff`.
5. Copy the webhook URL.
6. Click `Run once` in Make.
7. In FlowPilot, go to `/settings`.
8. Add a connector:

```text
Name: Make workflow handoff
Type: Make webhook
Endpoint URL: your Make webhook URL
Auth type: None
Secret ref: empty
```

9. Click `Test connector`.
10. Go back to Make and confirm it received the sample payload.
11. Add `Google Sheets -> Add a Row`.
12. Map FlowPilot fields to sheet columns.
13. Save and turn the scenario ON.

## Suggested Google Sheet Columns

```text
created_at
case_id
title
requester
department
risk_level
status
```

Example mapping:

```text
created_at -> Make current date/time
case_id -> case_id
title -> title
requester -> requester
department -> department
risk_level -> risk_level
status -> received
```

## Why Keep The Mock Connector

Make proves real integration.

Mock enterprise API proves reliability when external services are unavailable.

Together they show a stronger product design:

```text
real external automation + reliable internal fallback
```

The mock connector returns a realistic response:

```json
{
  "ok": true,
  "adapter": "mock_internal_api",
  "ticketId": "ENT-1234ABCD",
  "ticketType": "it_access_ticket",
  "status": "created",
  "createdAt": "2026-09-05T12:00:00.000Z"
}
```

## Interview Explanation

Use this wording:

> FlowPilot is the governance layer before automation. It uses AI to structure and assess requests, retrieves policy evidence, and requires review for risky actions. Only after approval does it send a controlled payload to Make or a mock enterprise API. Make demonstrates a real external automation path, while the mock adapter keeps the demo reliable.

Short version:

> Make is not the brain of the system. FlowPilot is the decision and governance layer. Make is only the execution channel after approval.

## What Is Required

Required:

- Make custom webhook
- FlowPilot Make connector
- One approved workflow run
- One successful execution attempt
- Audit log showing the connector result

Optional:

- Google Sheets row
- Discord notification
- Make API key authentication

Not needed now:

- Jira OAuth
- ServiceNow OAuth
- Power Automate OAuth
- full workflow builder
- enterprise vault integration

