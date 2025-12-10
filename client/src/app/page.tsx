'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ensureCorrectNetwork } from '../lib/web3'

export default function IntroPage() {
  const router = useRouter()
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState('')
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    checkConnection()
  }, [])

  const checkConnection = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' })
        if (accounts.length > 0) {
          // Check if on correct network before redirecting
          const chainId = await window.ethereum.request({ method: 'eth_chainId' })
          if (parseInt(chainId, 16) === 1337) {
            router.push('/dashboard')
            return
          }
        }
      } catch (err) {
        console.error('Error checking connection:', err)
      }
    }
    setIsChecking(false)
  }

  const connectWallet = async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      setError('MetaMask is not installed. Please install MetaMask to continue.')
      return
    }

    setIsConnecting(true)
    setError('')

    try {
      // First, ensure we're on the correct network
      await ensureCorrectNetwork()
      
      // Then request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      if (accounts.length > 0) {
        // Connected successfully, redirect to dashboard immediately
        router.push('/dashboard')
      }
    } catch (err: any) {
      if (err.code === 4001) {
        setError('Connection rejected. Please approve the connection in MetaMask.')
      } else {
        setError('Failed to connect wallet. Please try again.')
      }
      setIsConnecting(false)
    }
  }

  const features = [
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      title: 'Immutable Records',
      description: 'Every transaction is permanently recorded on the blockchain, ensuring tamper-proof data integrity.'
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
      title: 'Full Transparency',
      description: 'Track products from raw materials to end consumer with complete visibility at every stage.'
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      title: 'Real-time Updates',
      description: 'Instant notifications when products move through supply chain stages.'
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      title: 'Multi-party Collaboration',
      description: 'Seamlessly connect suppliers, manufacturers, distributors, and retailers on one platform.'
    }
  ]

  const stages = [
    { label: 'Raw Materials', icon: '🌿', color: 'bg-emerald-500' },
    { label: 'Manufacturing', icon: '🏭', color: 'bg-amber-500' },
    { label: 'Distribution', icon: '🚚', color: 'bg-violet-500' },
    { label: 'Retail', icon: '🏪', color: 'bg-orange-500' },
    { label: 'Consumer', icon: '👤', color: 'bg-blue-500' }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900">
      {/* Loading state */}
      {isChecking && (
        <div className="fixed inset-0 bg-slate-900 z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
            <p className="text-white/60">Checking wallet connection...</p>
          </div>
        </div>
      )}

      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-violet-500/15 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute -bottom-40 right-1/3 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 py-4">
        <nav className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <span className="text-2xl font-bold text-white">ChainGuard</span>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 px-6">
        <div className="max-w-7xl mx-auto pt-16 pb-24">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/20 rounded-full border border-indigo-400/30 mb-6">
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></span>
              <span className="text-indigo-300 text-sm font-medium">Powered by Blockchain Technology</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              Supply Chain
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400">
                Reimagined
              </span>
            </h1>
            
            <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
              Transform your supply chain with blockchain-powered transparency. 
              Track products in real-time, verify authenticity, and build trust with 
              immutable records from source to consumer.
            </p>

            {/* Connect Wallet */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={connectWallet}
                disabled={isConnecting}
                className="group relative px-8 py-4 bg-gradient-to-r from-indigo-500 to-violet-600 rounded-2xl text-white font-semibold text-lg shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all duration-300 hover:scale-105 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <span className="flex items-center gap-3">
                  {isConnecting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Connecting...
                    </>
                  ) : (
                    <>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      Connect Wallet
                    </>
                  )}
                </span>
              </button>
              
              <a
                href="#features"
                className="px-8 py-4 bg-white/5 border border-white/20 rounded-2xl text-white font-medium hover:bg-white/10 transition-all duration-300"
              >
                Learn More
              </a>
            </div>

            {error && (
              <div className="mt-6 inline-flex items-center gap-2 px-4 py-3 bg-red-500/20 rounded-xl border border-red-400/30 text-red-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}
          </div>

          {/* Supply Chain Flow Visualization */}
          <div className="mb-24">
            <div className="flex flex-wrap items-center justify-center gap-4 md:gap-0">
              {stages.map((stage, index) => (
                <div key={stage.label} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className={`w-16 h-16 ${stage.color} rounded-2xl flex items-center justify-center text-2xl shadow-lg transform hover:scale-110 transition-transform duration-300`}>
                      {stage.icon}
                    </div>
                    <span className="mt-2 text-sm text-slate-300 font-medium">{stage.label}</span>
                  </div>
                  {index < stages.length - 1 && (
                    <div className="hidden md:flex items-center mx-4">
                      <div className="w-12 h-0.5 bg-gradient-to-r from-slate-500 to-slate-600"></div>
                      <svg className="w-4 h-4 text-slate-500 -ml-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Features Grid */}
          <div id="features" className="scroll-mt-20">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Why ChainGuard?</h2>
              <p className="text-slate-400 max-w-xl mx-auto">
                Built on Ethereum blockchain technology for maximum security and transparency
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="group p-6 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 hover:border-indigo-500/50 hover:bg-white/10 transition-all duration-300"
                >
                  <div className="w-14 h-14 bg-gradient-to-br from-indigo-500/20 to-violet-500/20 rounded-xl flex items-center justify-center text-indigo-400 mb-4 group-hover:scale-110 transition-transform duration-300">
                    {feature.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* How It Works */}
          <div className="mt-24">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">How It Works</h2>
              <p className="text-slate-400 max-w-xl mx-auto">
                Get started in three simple steps
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-full flex items-center justify-center text-2xl font-bold text-white mx-auto mb-4 shadow-lg shadow-indigo-500/30">
                  1
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Connect Wallet</h3>
                <p className="text-slate-400">Link your MetaMask wallet to access the blockchain network securely.</p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center text-2xl font-bold text-white mx-auto mb-4 shadow-lg shadow-violet-500/30">
                  2
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Register Participants</h3>
                <p className="text-slate-400">Add suppliers, manufacturers, distributors, and retailers to your network.</p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-2xl font-bold text-white mx-auto mb-4 shadow-lg shadow-purple-500/30">
                  3
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Track Products</h3>
                <p className="text-slate-400">Monitor your products through every stage of the supply chain in real-time.</p>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="mt-24 text-center">
            <div className="inline-block p-8 bg-gradient-to-br from-indigo-500/20 to-violet-500/20 rounded-3xl border border-indigo-500/30 backdrop-blur-sm">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Ready to get started?</h2>
              <p className="text-slate-300 mb-6 max-w-md mx-auto">
                Connect your wallet and start tracking products with blockchain technology today.
              </p>
              <button
                onClick={connectWallet}
                disabled={isConnecting}
                className="px-8 py-3 bg-white text-indigo-600 rounded-xl font-semibold hover:bg-slate-100 transition-colors shadow-lg disabled:opacity-70"
              >
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 mt-16">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <span className="text-white font-semibold">ChainGuard</span>
            </div>
            <p className="text-slate-400 text-sm">
              © 2025 ChainGuard. Securing supply chains with blockchain technology.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
