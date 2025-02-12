import { createContext, useContext, useState, useEffect } from 'react'

const AgentContext = createContext()

export function AgentProvider({ children }) {
  const [agents, setAgents] = useState([])
  const [selectedAgent, setSelectedAgent] = useState(null)

  // Load agents and selected agent from localStorage on mount
  useEffect(() => {
    const storedAgents = localStorage.getItem('agents')
    const storedSelectedAgentId = localStorage.getItem('selectedAgentId')
    
    if (storedAgents) {
      const parsedAgents = JSON.parse(storedAgents)
      setAgents(parsedAgents)
      
      if (storedSelectedAgentId) {
        const selectedAgent = parsedAgents.find(
          agent => agent.id === Number(storedSelectedAgentId)
        )
        if (selectedAgent) {
          setSelectedAgent(selectedAgent)
        }
      }
    }
  }, [])

  // Save agents and selected agent to localStorage whenever they change
  useEffect(() => {
    if (agents.length > 0) {
      localStorage.setItem('agents', JSON.stringify(agents))
    }
    if (selectedAgent) {
      localStorage.setItem('selectedAgentId', selectedAgent.id.toString())
    }
  }, [agents, selectedAgent])

  const createAgent = (name) => {
    const newAgent = {
      id: Date.now(),
      name,
      description: '',
      image: 'G'
    }
    setAgents([...agents, newAgent])
    setSelectedAgent(newAgent)
  }

  const updateAgent = (id, updates) => {
    const updatedAgents = agents.map(agent => 
      agent.id === id ? { ...agent, ...updates } : agent
    )
    setAgents(updatedAgents)
    if (selectedAgent?.id === id) {
      setSelectedAgent({ ...selectedAgent, ...updates })
    }
  }

  return (
    <AgentContext.Provider value={{
      agents,
      selectedAgent,
      setSelectedAgent,
      createAgent,
      updateAgent
    }}>
      {children}
    </AgentContext.Provider>
  )
}

export const useAgents = () => useContext(AgentContext) 