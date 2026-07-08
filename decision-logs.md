# Goal is to be core of prompting , every kind of prompting and agent design happens here 


## quicks 
- paste external prompts and see how they go, make quick additions, save in the vault/folder
- markdown parser, ( in settings change sizes and themes for markdown )

## Prompt 
- Agent builder -> flow chart designer 
- sections, use templates, -> select a template match to the core flow and make changes with LLM

## Workspaces
- add different Workspaces within the base directory, so different vaults has clean separation of concerns


## New architecture 
- removed local rag Fast Embeddig 
- better workspace directory for clean separation of concerns 
- Cloud sync native architecture 
- Agents 

--
08/07
- all prompts are just documents with editable sections add comments with type quick | Prompt

## Document Storage

* Each workspace has its own SQLite database located at `.prmptly/app.db`.
* SQLite stores metadata, relationships, indexing, search, and document structure.
* Large or editable content is stored on the filesystem.
* File paths are **not** stored in the database. They are deterministic and derived from the document ID.

### Workspace Structure

```text
Workspace/
│
├── .prmptly/
│   └── app.db
│
├── documents/
│   ├── <document-id>/
│   │   ├── scratchpad.md
│   │   ├── scratchpad.flow.json
│   │   └── output.json
│   └── ...
│
├── templates/
├── library/
└── assets/
```

### Documents

A document is the primary editable entity. It owns its sections, scratchpad, canvas, and generated output.

Database stores:

* id
* type (`prompt` | `quick`)
* name
* templateId
* collectionId
* sections (`DocumentSection[]`)
* meta
* createdAt
* updatedAt

Filesystem stores:

* `scratchpad.md`
* `scratchpad.flow.json`
* `output.json`

### Sections

* Documents own their own `DocumentSection[]`.
* Templates act only as blueprints for creating new documents.
* Once created, sections are independent and can be reordered, renamed, deleted, duplicated, or edited without affecting the template.

### Markdown Convention

* `#` → Document title
* `##` → Document section
* `###+` → Headings inside a section (formatting only)

Only `##` creates a new `DocumentSection`.

### Output Generation

`buildOutput()` converts `DocumentSection[]` into the selected output format (`plain`, `json`, or `xml`).

It is a pure function and does not read/write files or interact with the database. 
output is never stored : copy button always just builds the output and copy pastes to your clipboard or users can simply download the output which generates the output file 

### Local-First Principle

SQLite manages metadata and querying, while the filesystem stores document content. Since file locations are deterministic from the document ID, no file paths are persisted in the database.
