import React, { useState, useEffect } from 'react'
import { useAgents } from '../context/AgentContext'

const AgentDetails = () => {
  const { selectedAgent, updateAgent } = useAgents()
  const [isEditingName, setIsEditingName] = useState(false)
  const [isEditingDesc, setIsEditingDesc] = useState(false)
  const [tempName, setTempName] = useState(selectedAgent?.name || '')
  const [tempDesc, setTempDesc] = useState(selectedAgent?.description || '')

  // Update temp states when selected agent changes
  useEffect(() => {
    setTempName(selectedAgent?.name || '')
    setTempDesc(selectedAgent?.description || '')
  }, [selectedAgent])

  const handleNameSubmit = () => {
    if (tempName.trim() && tempName !== selectedAgent.name) {
      updateAgent(selectedAgent.id, { name: tempName.trim() })
    }
    setIsEditingName(false)
  }

  const handleDescSubmit = () => {
    if (tempDesc !== selectedAgent.description) {
      updateAgent(selectedAgent.id, { description: tempDesc })
    }
    setIsEditingDesc(false)
  }

  return (
    <div className="flex-1 p-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-white">
            {selectedAgent?.image}
          </div>
          <h2 className="text-xl font-semibold text-gray-200">{selectedAgent?.name}</h2>
        </div>
        <div className="flex items-center space-x-4">
          <button className="text-gray-400 hover:text-gray-200">Overview</button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="space-y-4">
          <div className="flex justify-between items-center p-4 bg-[#1a1a1a] rounded-lg">
            <span className="text-gray-400">Name</span>
            {isEditingName ? (
              <div className="flex items-center space-x-2">
                <input
                  autoFocus
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onBlur={handleNameSubmit}
                  onKeyPress={(e) => e.key === 'Enter' && handleNameSubmit()}
                  className="bg-gray-900 text-gray-200 rounded px-2 py-1"
                />
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <span className="text-gray-200">{selectedAgent?.name}</span>
                <button 
                  onClick={() => setIsEditingName(true)}
                  className="text-green-500 hover:text-green-400"
                >
                  ✏️
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center p-4 bg-[#1a1a1a] rounded-lg">
            <span className="text-gray-400">Description</span>
            {isEditingDesc ? (
              <div className="flex items-center space-x-2">
                <input
                  autoFocus
                  type="text"
                  value={tempDesc}
                  onChange={(e) => setTempDesc(e.target.value)}
                  onBlur={handleDescSubmit}
                  onKeyPress={(e) => e.key === 'Enter' && handleDescSubmit()}
                  className="bg-gray-900 text-gray-200 rounded px-2 py-1 w-64"
                />
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <span className="text-gray-400 italic">
                  {selectedAgent?.description || `Add a description for Agent ${selectedAgent?.name}`}
                </span>
                <button 
                  onClick={() => setIsEditingDesc(true)}
                  className="text-green-500 hover:text-green-400"
                >
                  ✏️
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Actions Section */}
        <div>
          <h3 className="text-gray-200 text-lg font-semibold mb-4">Actions</h3>
          <div className="text-sm text-gray-400">What Agent {selectedAgent?.name} can do</div>
          <div className="grid grid-cols-4 gap-4 mt-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="h-24 bg-[#1a1a1a] rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AgentDetails 