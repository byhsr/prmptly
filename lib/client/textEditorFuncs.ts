import { JSONContent } from "@tiptap/react"
import { OutputFormat } from "@/components/ui/SmartTextEditor"


export function nodeToPlain(node: JSONContent, depth = 0): string {
    const indent = "  ".repeat(depth)

    switch (node.type) {
        case "doc":
            return (node.content ?? [])
                .map((n) => nodeToPlain(n, depth))
                .filter(Boolean)
                .join("\n")

        case "paragraph": {
            const text = (node.content ?? []).map((n) => nodeToPlain(n, 0)).join("")
            return text ? `${indent}${text}` : ""
        }

        case "bulletList":
            return (node.content ?? []).map((n) => nodeToPlain(n, depth)).join("\n")

        case "listItem": {
            const lines: string[] = []
            for (const part of node.content ?? []) {
                if (part.type === "paragraph") {
                    const text = (part.content ?? []).map((n) => nodeToPlain(n, 0)).join("")
                    lines.push(`${indent}- ${text}`)
                } else {
                    // nested list
                    lines.push(nodeToPlain(part, depth + 1))
                }
            }
            return lines.join("\n")
        }

        case "text":
            return node.text ?? ""

        case "mention":
            return `@${node.attrs?.id ?? ""}`

        default:
            return (node.content ?? []).map((n) => nodeToPlain(n, depth)).join("")
    }
}

export function listItemToClean(node: JSONContent): unknown {
    const para = node.content?.find((p) => p.type === "paragraph")
    const nested = node.content?.find((p) => p.type === "bulletList")
    const text = (para?.content ?? []).map((n) => nodeToPlain(n, 0)).join("")
    return nested
        ? { value: text, children: (nested.content ?? []).map(listItemToClean).filter(Boolean) }
        : text
}

export function nodeToCleanItem(node: JSONContent): unknown {
    switch (node.type) {
        case "paragraph": {
            const text = (node.content ?? []).map((n) => nodeToPlain(n, 0)).join("")
            return text ? { type: "text", value: text } : null
        }
        case "bulletList":
            return {
                type: "list",
                items: (node.content ?? []).map(listItemToClean).filter(Boolean),
            }
        default:
            return null
    }
}


export function docToCleanJson(node: JSONContent): unknown {
    switch (node.type) {
        case "doc": {
            const content = (node.content ?? []).map(nodeToCleanItem).filter(Boolean)
            return { prompt: content }
        }

        case "paragraph": {
            const text = (node.content ?? []).map((n) => nodeToPlain(n, 0)).join("")
            return text || null
        }

        case "bulletList":
            return { list: (node.content ?? []).map(docToCleanJson).filter(Boolean) }

        case "listItem": {
            const parts = node.content ?? []
            const para = parts.find((p) => p.type === "paragraph")
            const nested = parts.find((p) => p.type === "bulletList")
            const text = (para?.content ?? []).map((n) => nodeToPlain(n, 0)).join("")
            return nested
                ? { item: text, children: docToCleanJson(nested) }
                : { item: text }
        }

        case "mention":
            return `@${node.attrs?.id ?? ""}`

        default:
            return null
    }
}


export function nodeToXml(node: JSONContent, depth = 0): string {
    const indent = "  ".repeat(depth)

    switch (node.type) {
        case "doc":
            return (node.content ?? [])
                .map((n) => nodeToXml(n, depth))
                .filter(Boolean)
                .join("\n")

        case "paragraph": {
            const text = (node.content ?? []).map((n) => nodeToXml(n, 0)).join("")
            return text ? `${indent}<p>${text}</p>` : ""
        }

        case "bulletList": {
            const inner = (node.content ?? []).map((n) => nodeToXml(n, depth + 1)).join("\n")
            return `${indent}<list>\n${inner}\n${indent}</list>`
        }

        case "listItem": {
            const parts: string[] = []
            for (const part of node.content ?? []) {
                if (part.type === "paragraph") {
                    const text = (part.content ?? []).map((n) => nodeToXml(n, 0)).join("")
                    parts.push(`${indent}  <item>${text}</item>`)
                } else {
                    parts.push(nodeToXml(part, depth + 1))
                }
            }
            return parts.join("\n")
        }

        case "text":
            return node.text ?? ""

        case "mention":
            return `<mention id="${node.attrs?.id ?? ""}" />`

        default:
            return (node.content ?? []).map((n) => nodeToXml(n, 0)).join("")
    }
}

export function serializeDoc(doc: JSONContent, format: OutputFormat): string {
    switch (format) {
        case "plain":
            return nodeToPlain(doc)

        case "json":
            return JSON.stringify(docToCleanJson(doc), null, 2)

        case "xml":
            // no wrapper here — compile adds the section tag around it
            return nodeToXml(doc, 0)
    }
}