# Phase 1 Progress Report

## Purpose

This report records the current implementation status after the first development phase, the simplifications that are currently accepted, the confirmed product gaps, and the recommended priorities for the next phase.

It is a status document. The target product behavior remains defined by [PRD.md](D:/CodeSpace/dbe-cloud-groupproject/docs/PRD.md).

## Current State Summary

The project already has a working course-project skeleton with a unified `api-gateway`, four backend services, local Docker Compose orchestration, and the expected infrastructure services:

- `api-gateway`
- `car-configurator`
- `merch-shop`
- `ai-feature`
- `shopping-cart`
- `mysql`
- `redis`
- `minio`

The main user-visible flows currently present are:

- opening the unified gateway and navigating across all pages
- selecting one of two car models and available colors in the configurator
- reading merch data from MySQL and adding merch items to the cart
- calling Gemini through `ai-feature` and returning recommendation links
- storing cart state in Redis using a session cookie
- calculating map routes in the browser with Google Maps JS API

## Implemented and Accepted for Phase 1

The following design simplifications are currently accepted and do not require immediate redesign:

- shared use of a single `bmw_app` MySQL database for the current phase
- AI service returning frontend links directly
- reduced configurator parameter depth in phase 1, with future expansion left open

These choices are considered temporary or phase-scoped implementation decisions, not blockers.

## Confirmed Product Gaps

The following gaps are now explicitly confirmed and should remain visible in future planning:

### 1. Merch recommendation landing

AI-generated merch links currently return the user to the generic merch page rather than to a dedicated product-detail experience.

Impact:

- recommendations are less precise
- AI cannot deep-link the user to one exact product view

### 2. Structured AI prompt/template design

The AI flow works, but the prompt/template and structured response contract still need deliberate design work.

Impact:

- recommendation quality depends heavily on prompt wording
- frontend rendering contracts are less explicit than they should be
- later extension to richer recommendation metadata will be harder without a stable schema

### 3. Cart quantity updates

The cart supports add, list, and remove, but not update-quantity behavior.

Impact:

- merch purchase flows are less ergonomic
- repeated additions are a weak substitute for direct quantity editing
- totals cannot be adjusted through a standard cart interaction

### 4. Route destination endpoint

The route planning page currently hardcodes fixed BMW locations in the frontend template. The intended product design still requires `api-gateway` to serve the destination list through an internal endpoint.

Impact:

- destination data is embedded in the page instead of being managed as backend-owned product data
- maintenance and extension of route targets are more manual than intended

## Interpreting the Current Phase Correctly

The current project is not drifting away from its product direction. The present state is better described as:

- architecture skeleton established
- first end-to-end user flows working
- several richer product contracts intentionally deferred

This means the main risk is not architectural confusion, but under-specification of the next-phase contracts around:

- AI input/output structure
- merch deep-linking
- cart editing behavior
- route destination ownership

## Recommended Next-Phase Priorities

Priority 1:

- design the AI prompt/template and response schema
- define the merch product-detail route and recommendation landing format

Priority 2:

- add cart quantity update behavior for merchandise flows
- define car-item quantity behavior explicitly

Priority 3:

- add the `api-gateway` destination endpoint and move hardcoded destination data behind it

Priority 4:

- extend configurator parameters and result structure when phase goals require deeper configuration logic
