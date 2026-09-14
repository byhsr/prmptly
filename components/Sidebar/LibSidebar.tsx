// components/Sidebar/LibSidebar.tsx
import { SkillGroupTree } from "../library/SkillGroupTree"

export const LibrarySidebarPanel = () => {
  return (
    <div className="flex flex-col h-full w-full">
      <SkillGroupTree />
    </div>
  )
}
