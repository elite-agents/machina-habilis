import React, { useState } from 'react'
import { useAgents } from '../context/AgentContext'

const ChatInterface = () => {
  const { selectedAgent } = useAgents()
  const [message, setMessage] = useState('')
  const [chatHistory, setChatHistory] = useState([])

  const handleSendMessage = (e) => {
    e.preventDefault()
    if (!message.trim()) return

    // Add user message to chat
    const newMessage = {
      id: Date.now(),
      content: message.trim(),
      sender: 'user',
      timestamp: new Date().toISOString()
    }
    
    setChatHistory([...chatHistory, newMessage])
    setMessage('')

    // TODO: Implement actual agent response logic
    // For now, just echo a response
    setTimeout(() => {
      const agentResponse = {
        id: Date.now() + 1,
        content: `I am ${selectedAgent.name}. You said: ${message.trim()}`,
        sender: 'agent',
        timestamp: new Date().toISOString()
      }
      setChatHistory(prev => [...prev, agentResponse])
    }, 1000)
  }

  return (
    <div className="w-96 border-l border-gray-800 p-6 bg-[#1a1a1a] flex flex-col">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-white">
          {selectedAgent?.image}
        </div>
        <h2 className="text-lg font-semibold text-gray-200">
          Chat with Agent {selectedAgent?.name}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {chatHistory.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                msg.sender === 'user'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-800 text-gray-200'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSendMessage} className="relative">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={`Message ${selectedAgent?.name}`}
          className="w-full bg-gray-900 text-gray-200 rounded-lg pl-4 pr-12 py-3 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
        <button
          type="submit"
          disabled={!message.trim()}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 disabled:opacity-50"
        >
          ➤
        </button>
      </form>
    </div>
  )
}

export default ChatInterface 