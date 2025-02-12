import React from 'react'

const ChatInterface = () => {
  return (
    <div className="w-96 border-l border-gray-800 p-6 bg-[#1a1a1a]">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-white">
          G
        </div>
        <h2 className="text-lg font-semibold text-gray-200">Chat with Agent Sexyagent</h2>
      </div>

      <div className="h-[calc(100vh-200px)] flex flex-col justify-end">
        <div className="space-y-4 mb-4">
          {/* Chat messages would go here */}
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Message Sexyagent"
            className="w-full bg-gray-900 text-gray-200 rounded-lg pl-4 pr-12 py-3 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
          <button className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
            ➤
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChatInterface 