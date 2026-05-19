"use client"

import { TabBar } from "./tab-bar"
import { FileTab } from "./file-tab"
import { motion, AnimatePresence } from "framer-motion"

interface WorkspaceProps {
  openFiles: string[]
  activeFile: string | null
  onTabSelect: (filename: string) => void
  onTabClose: (filename: string) => void
}

export function Workspace({ openFiles, activeFile, onTabSelect, onTabClose }: WorkspaceProps) {
  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">

      <div className="flex-1 overflow-hidden border bg-background">
        <AnimatePresence mode="wait">
          {activeFile ? (
            <motion.div
              key={activeFile}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="h-full"
            >
              <FileTab filename={activeFile} />
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex h-full items-center justify-center"
            >
              <div className="text-center">
                <p className="text-muted text-lg">No file open</p>
                <p className="text-muted/60 text-sm mt-1">Select a file from the sidebar to get started</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
