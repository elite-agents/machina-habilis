import React from 'react'

const AgentDetails = () => {
  return (
    <div className="flex-1 p-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-white">
            G
          </div>
          <h2 className="text-xl font-semibold text-gray-200">Sexyagent</h2>
        </div>
        <div className="flex items-center space-x-4">
          <button className="text-gray-400 hover:text-gray-200">Overview</button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Agent Properties */}
        <div className="space-y-4">
          <div className="flex justify-between items-center p-4 bg-[#1a1a1a] rounded-lg">
            <span className="text-gray-400">Name</span>
            <div className="flex items-center space-x-2">
              <span className="text-gray-200">sexyagent</span>
              <button className="text-green-500">✏️</button>
            </div>
          </div>

          <div className="flex justify-between items-center p-4 bg-[#1a1a1a] rounded-lg">
            <span className="text-gray-400">Description</span>
            <div className="flex items-center space-x-2">
              <span className="text-gray-400 italic">Add a description for Agent Sexyagent</span>
              <button className="text-green-500">✏️</button>
            </div>
          </div>
        </div>

        {/* Actions Section */}
        <div>
          <h3 className="text-gray-200 text-lg font-semibold mb-4">Actions</h3>
          <div className="text-sm text-gray-400">What Agent Sexyagent can do</div>
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