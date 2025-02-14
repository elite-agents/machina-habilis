import Sidebar from './components/Sidebar';
import AgentDetails from './components/AgentDetails';
import ChatInterface from './components/ChatInterface';
import EmptyState from './components/EmptyState';
import { AgentProvider, useAgents } from './context/AgentContext';

function AppContent() {
  const { selectedAgent } = useAgents();

  return (
    <div className="min-h-screen bg-[#121212] text-white">
      <Sidebar />
      <div className="ml-56 flex">
        {selectedAgent ? (
          <>
            <AgentDetails />
            <ChatInterface />
          </>
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <AgentProvider>
      <AppContent />
    </AgentProvider>
  );
}

export default App;
