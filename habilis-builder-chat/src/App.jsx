import Sidebar from './components/Sidebar'
import AgentDetails from './components/AgentDetails'
import ChatInterface from './components/ChatInterface'

function App() {
  return (
    <div className="min-h-screen bg-[#121212] text-white">
      <Sidebar />
      <div className="ml-56 flex">
        <AgentDetails />
        <ChatInterface />
      </div>
    </div>
  )
}

export default App 