import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { BrowserProvider, Contract, JsonRpcProvider, formatEther } from 'ethers'
import ABI from './abi.json'
import {
  CONTRACT_ADDRESS,
  EXPECTED_CHAIN_ID,
  EXPECTED_NETWORK_NAME,
  EXPLORER_BASE_URL,
} from './config'

const CANDIDATE_NAMES = ['Léon Blum', 'Jacques Chirac', 'François Mitterrand']
const READ_ONLY_RPC_URL = import.meta.env.VITE_SEPOLIA_RPC_URL?.trim() ?? ''
const TX_INITIAL_STATE = {
  status: 'idle',
  hash: null,
  blockNumber: null,
  error: null,
}

function shortAddress(value, start = 6, end = 4) {
  if (!value) return '—'
  return `${value.slice(0, start)}...${value.slice(-end)}`
}

function formatCountdown(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

function toSafeNumber(value, fallback = 0) {
  if (value == null) return fallback
  try {
    return Number(value)
  } catch {
    return fallback
  }
}

async function buildReadProvider() {
  if (typeof window !== 'undefined' && window.ethereum) {
    const metamaskProvider = new BrowserProvider(window.ethereum)

    try {
      const network = await metamaskProvider.getNetwork()
      if (network.chainId === BigInt(EXPECTED_CHAIN_ID)) {
        return {
          provider: metamaskProvider,
          mode: 'metamask',
          info: null,
          error: null,
        }
      }
    } catch {
    }
  }

  if (READ_ONLY_RPC_URL) {
    return {
      provider: new JsonRpcProvider(READ_ONLY_RPC_URL),
      mode: 'rpc',
      info: 'Mode lecture seule via RPC Sepolia. MetaMask reste nécessaire pour voter.',
      error: null,
    }
  }

  if (typeof window !== 'undefined' && window.ethereum) {
    return {
      provider: null,
      mode: null,
      info: null,
      error: `MetaMask est détecté, mais pas sur ${EXPECTED_NETWORK_NAME}. Passez sur le bon réseau ou configurez VITE_SEPOLIA_RPC_URL.`,
    }
  }

  return {
    provider: null,
    mode: null,
    info: null,
    error:
      "Aucun provider disponible. Installez MetaMask ou renseignez VITE_SEPOLIA_RPC_URL pour activer la lecture seule.",
  }
}

function App() {
  const [account, setAccount] = useState(null)
  const [balance, setBalance] = useState(null)
  const [provider, setProvider] = useState(null)
  const [providerMode, setProviderMode] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isVoting, setIsVoting] = useState(false)
  const [cooldownSeconds, setCooldownSeconds] = useState(0)
  const [txState, setTxState] = useState(TX_INITIAL_STATE)
  const [lastEvent, setLastEvent] = useState(null)
  const [explorerEvents, setExplorerEvents] = useState([])
  const [explorerOpen, setExplorerOpen] = useState(false)
  const [explorerLoading, setExplorerLoading] = useState(false)
  const [selectedBlock, setSelectedBlock] = useState(null)
  const [blockModalOpen, setBlockModalOpen] = useState(false)
  const [blockLoading, setBlockLoading] = useState(false)

  const totalVotes = useMemo(
    () => candidates.reduce((sum, candidate) => sum + candidate.votes, 0),
    [candidates],
  )

  const loadCandidates = useCallback(async (activeProvider) => {
    if (!activeProvider) return

    const contract = new Contract(CONTRACT_ADDRESS, ABI, activeProvider)
    const count = await contract.getCandidatesCount()

    const list = await Promise.all(
      Array.from({ length: Number(count) }, async (_, index) => {
        const [name, voteCount] = await contract.getCandidate(index)
        return {
          id: index,
          name,
          votes: toSafeNumber(voteCount),
        }
      }),
    )

    setCandidates(list)
  }, [])

  const loadBalance = useCallback(async (address, activeProvider) => {
    if (!address || !activeProvider) {
      setBalance(null)
      return
    }

    try {
      const rawBalance = await activeProvider.getBalance(address)
      const eth = Number(formatEther(rawBalance))
      setBalance(eth)
    } catch {
      setBalance(null)
    }
  }, [])

  const syncCooldownFromChain = useCallback(async (address, activeProvider) => {
    if (!address || !activeProvider) {
      setCooldownSeconds(0)
      return
    }

    try {
      const contract = new Contract(CONTRACT_ADDRESS, ABI, activeProvider)
      const secondsLeft = await contract.getTimeUntilNextVote(address)
      setCooldownSeconds(toSafeNumber(secondsLeft))
    } catch {
      setCooldownSeconds(0)
    }
  }, [])

  const syncWalletSession = useCallback(
    async (activeProvider) => {
      if (!activeProvider || !(activeProvider instanceof BrowserProvider)) {
        setAccount(null)
        setBalance(null)
        setCooldownSeconds(0)
        return false
      }

      try {
        const network = await activeProvider.getNetwork()
        if (network.chainId !== BigInt(EXPECTED_CHAIN_ID)) {
          setAccount(null)
          setBalance(null)
          setCooldownSeconds(0)
          setError(`Mauvais réseau - connectez MetaMask sur ${EXPECTED_NETWORK_NAME}.`)
          return false
        }

        const accounts = await activeProvider.send('eth_accounts', [])
        if (!accounts.length) {
          setAccount(null)
          setBalance(null)
          setCooldownSeconds(0)
          return false
        }

        const signer = await activeProvider.getSigner()
        const address = await signer.getAddress()
        setAccount(address)
        setError(null)

        await Promise.all([
          loadCandidates(activeProvider),
          syncCooldownFromChain(address, activeProvider),
          loadBalance(address, activeProvider),
        ])

        return true
      } catch {
        setAccount(null)
        setBalance(null)
        setCooldownSeconds(0)
        return false
      }
    },
    [loadBalance, loadCandidates, syncCooldownFromChain],
  )

  const initialize = useCallback(async () => {
    const setup = await buildReadProvider()

    setInfo(setup.info)

    if (!setup.provider) {
      setProvider(null)
      setProviderMode(null)
      setCandidates([])
      if (setup.error) setError(setup.error)
      return
    }

    setProvider(setup.provider)
    setProviderMode(setup.mode)

    try {
      await loadCandidates(setup.provider)
      if (setup.mode === 'metamask') {
        await syncWalletSession(setup.provider)
      } else {
        setAccount(null)
        setBalance(null)
        setCooldownSeconds(0)
      }
      setError(setup.error)
    } catch (err) {
      setError(err?.message || 'Impossible de charger les données on-chain.')
    }
  }, [loadCandidates, syncWalletSession])

  const connectWallet = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      setError("MetaMask n'est pas installé.")
      return
    }

    setIsConnecting(true)
    setTxState(TX_INITIAL_STATE)

    try {
      const metamaskProvider = new BrowserProvider(window.ethereum)
      await metamaskProvider.send('eth_requestAccounts', [])

      const network = await metamaskProvider.getNetwork()
      if (network.chainId !== BigInt(EXPECTED_CHAIN_ID)) {
        setError(`Mauvais réseau - connectez MetaMask sur ${EXPECTED_NETWORK_NAME}.`)
        setProvider(metamaskProvider)
        setProviderMode('metamask')
        return
      }

      const signer = await metamaskProvider.getSigner()
      const address = await signer.getAddress()

      setAccount(address)
      setProvider(metamaskProvider)
      setProviderMode('metamask')
      setError(null)
      setInfo(null)

      await Promise.all([
        loadCandidates(metamaskProvider),
        syncCooldownFromChain(address, metamaskProvider),
        loadBalance(address, metamaskProvider),
      ])
    } catch (err) {
      if (err?.code === 4001) {
        setError('Connexion refusée.')
      } else {
        setError(err?.message || 'Connexion impossible.')
      }
    } finally {
      setIsConnecting(false)
    }
  }, [loadBalance, loadCandidates, syncCooldownFromChain])

  const vote = useCallback(
    async (candidateIndex) => {
      if (!provider || !account) {
        setError('Connectez MetaMask avant de voter.')
        return
      }

      try {
        setIsVoting(true)
        setError(null)
        setTxState({ status: 'awaiting-signature', hash: null, blockNumber: null, error: null })

        const signer = await provider.getSigner()
        const voteContract = new Contract(CONTRACT_ADDRESS, ABI, signer)

        const secondsLeft = await voteContract.getTimeUntilNextVote(account)
        const cooldown = toSafeNumber(secondsLeft)
        if (cooldown > 0) {
          setCooldownSeconds(cooldown)
          setTxState(TX_INITIAL_STATE)
          return
        }

        const tx = await voteContract.vote(candidateIndex)
        setTxState({
          status: 'broadcasted',
          hash: tx.hash,
          blockNumber: null,
          error: null,
        })

        setTxState((current) => ({ ...current, status: 'confirming' }))
        const receipt = await tx.wait()

        setTxState({
          status: 'confirmed',
          hash: tx.hash,
          blockNumber: receipt?.blockNumber ?? null,
          error: null,
        })

        await Promise.all([
          loadCandidates(provider),
          syncCooldownFromChain(account, provider),
          loadBalance(account, provider),
        ])
      } catch (err) {
        const message = err?.code === 4001 ? 'Transaction annulée.' : err?.message || 'Transaction impossible.'
        setTxState({ status: 'error', hash: null, blockNumber: null, error: message })
        setError(message)
      } finally {
        setIsVoting(false)
      }
    },
    [account, loadBalance, loadCandidates, provider, syncCooldownFromChain],
  )

  const loadExplorerEvents = useCallback(async () => {
    if (!provider) return

    setExplorerLoading(true)

    try {
      const explorerContract = new Contract(CONTRACT_ADDRESS, ABI, provider)
      const rawEvents = await explorerContract.queryFilter(explorerContract.filters.Voted(), -1000)
      const lastTwentyEvents = rawEvents.slice(-20).reverse()

      const enrichedEvents = await Promise.all(
        lastTwentyEvents.map(async (event) => {
          const idx = toSafeNumber(event.args?.candidateIndex)
          let timestamp = null
          let gasUsed = null

          try {
            const block = await provider.getBlock(event.blockNumber)
            timestamp = block?.timestamp ?? null
          } catch {
            timestamp = null
          }

          try {
            const receipt = await provider.getTransactionReceipt(event.transactionHash)
            gasUsed = receipt?.gasUsed != null ? toSafeNumber(receipt.gasUsed, null) : null
          } catch {
            gasUsed = null
          }

          return {
            hash: event.transactionHash,
            blockNumber: event.blockNumber,
            voter: event.args?.voter,
            candidateName: CANDIDATE_NAMES[idx] ?? `Candidat #${idx}`,
            timestamp,
            gasUsed,
          }
        }),
      )

      setExplorerEvents(enrichedEvents)
    } catch {
      setExplorerEvents([])
    } finally {
      setExplorerLoading(false)
    }
  }, [provider])

  const openBlockDetails = useCallback(
    async (blockNumber) => {
      if (!provider) return

      setBlockLoading(true)
      setBlockModalOpen(true)

      try {
        const block = await provider.getBlock(blockNumber)
        setSelectedBlock(block)
      } catch {
        setSelectedBlock(null)
      } finally {
        setBlockLoading(false)
      }
    },
    [provider],
  )

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    if (!cooldownSeconds || cooldownSeconds <= 0) return undefined

    const timer = window.setInterval(() => {
      setCooldownSeconds((previous) => {
        if (previous <= 1) {
          window.clearInterval(timer)
          return 0
        }
        return previous - 1
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [cooldownSeconds])

  useEffect(() => {
    if (!provider) return undefined

    const listenContract = new Contract(CONTRACT_ADDRESS, ABI, provider)

    const handler = async (voter, candidateIndex) => {
      const idx = toSafeNumber(candidateIndex)
      setLastEvent({
        voter: shortAddress(voter),
        candidateName: CANDIDATE_NAMES[idx] ?? `Candidat #${idx}`,
      })

      try {
        await loadCandidates(provider)
        if (account) {
          await syncCooldownFromChain(account, provider)
        }
      } catch {
      }
    }

    listenContract.on('Voted', handler)

    return () => {
      listenContract.off('Voted', handler)
    }
  }, [account, loadCandidates, provider, syncCooldownFromChain])

  useEffect(() => {
    if (!explorerOpen || !provider) return
    loadExplorerEvents()
  }, [explorerOpen, loadExplorerEvents, provider])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return undefined

    const handleAccountsChanged = async () => {
      await initialize()
    }

    const handleChainChanged = async () => {
      setTxState(TX_INITIAL_STATE)
      setLastEvent(null)
      setSelectedBlock(null)
      setBlockModalOpen(false)
      await initialize()
    }

    window.ethereum.on('accountsChanged', handleAccountsChanged)
    window.ethereum.on('chainChanged', handleChainChanged)

    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
      window.ethereum.removeListener('chainChanged', handleChainChanged)
    }
  }, [initialize])

  return (
    <div className="app-shell">
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />

      <main className="app-container">
        <section className="hero card">
          <div>
            <h1>Bureau de vote </h1>
            <br></br>
            <div className="wallet-box">
              {!account ? (
                <button className="primary-button" onClick={connectWallet} disabled={isConnecting}>
                  {isConnecting ? 'Connexion...' : 'Connecter MetaMask'}
                </button>
              ) : (
                <>
                  <span className="wallet-pill">{EXPECTED_NETWORK_NAME}</span>
                  <strong title={account}>{account}</strong>
                  <span>
                    Contrat : {CONTRACT_ADDRESS}
                  </span>
                </>
              )}
            </div>
          </div>
        </section>

        {info && <div className="banner banner-info">ℹ {info}</div>}
        {error && <div className="banner banner-error">⚠ {error}</div>}
        {txState.error && <div className="banner banner-error">⚠ {txState.error}</div>}

        {lastEvent && (
          <section className="card live-event">
            <span>⚡ Nouveau vote détecté</span>
            <strong>
              {lastEvent.voter} a voté pour {lastEvent.candidateName}
            </strong>
          </section>
        )}

        <section className="grid-main">
          <div className="card">
            <div className="section-heading">
              <div>
                <h2>Scores en temps réel</h2>
              </div>
              <div className="section-meta">{totalVotes} vote(s) au total</div>
            </div>

            <div className="candidate-list">
              {candidates.map((candidate) => {
                const ratio = totalVotes > 0 ? (candidate.votes / totalVotes) * 100 : 0

                return (
                  <article className="candidate-card" key={candidate.id}>
                    <div className="candidate-topline">
                      <div>
                        <h3>{candidate.name}</h3>
                        <p>{candidate.votes} vote(s)</p>
                      </div>
                      <span className="candidate-percent">{ratio.toFixed(1)}%</span>
                    </div>

                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${ratio}%` }} />
                    </div>

                    {account && (
                      <button
                        className="secondary-button"
                        onClick={() => vote(candidate.id)}
                        disabled={isVoting || cooldownSeconds > 0}
                      >
                        {isVoting ? 'Vote en cours...' : `Voter pour ${candidate.name}`}
                      </button>
                    )}
                  </article>
                )
              })}
            </div>
          </div>

          <div className="side-column">
            <section className="card">
              <div className="section-heading compact">
                <div>
                  <h2>Prochain vote</h2>
                </div>
              </div>

              {account ? (
                cooldownSeconds > 0 ? (
                  <div className="countdown-box">
                    <p>Temps d’attente imposé par le smart contract.</p>
                    <div className="countdown-value">{formatCountdown(cooldownSeconds)}</div>
                  </div>
                ) : (
                  <div className="countdown-box ready">
                    <p>Vous pouvez voter maintenant.</p>
                    <div className="countdown-value">00:00</div>
                    <small>Aucun cooldown actif.</small>
                  </div>
                )
              ) : (
                <div className="countdown-box neutral">
                  <p>Connectez MetaMask pour voir votre cooldown personnel.</p>
                </div>
              )}
            </section>

            <section className="card">
              <div className="section-heading compact">
                <div>
                  <p className="section-kicker">Transaction</p>
                  <h2>Suivi temps réel</h2>
                </div>
              </div>

              <ol className="tx-steps">
                <li className={txState.status === 'awaiting-signature' ? 'active' : ''}>
                  Signature MetaMask
                </li>
                <li
                  className={
                    txState.status === 'broadcasted' ||
                    txState.status === 'confirming' ||
                    txState.status === 'confirmed'
                      ? 'active'
                      : ''
                  }
                >
                  Transaction envoyée
                </li>
                <li className={txState.status === 'confirming' ? 'active' : ''}>Confirmation on-chain</li>
                <li className={txState.status === 'confirmed' ? 'active' : ''}>Bloc final</li>
              </ol>

              <div className="tx-details">
                {txState.hash ? (
                  <p>
                    Hash :{' '}
                    <a href={`${EXPLORER_BASE_URL}/tx/${txState.hash}`} target="_blank" rel="noreferrer">
                      {shortAddress(txState.hash, 12, 8)}
                    </a>
                  </p>
                ) : (
                  <p>Aucune transaction en cours.</p>
                )}

                {txState.status === 'awaiting-signature' && <p>MetaMask attend votre signature.</p>}
                {txState.status === 'broadcasted' && <p>La transaction a été diffusée sur le réseau.</p>}
                {txState.status === 'confirming' && <p>La transaction attend sa confirmation dans un bloc.</p>}
                {txState.status === 'confirmed' && txState.blockNumber != null && (
                  <p>
                    Confirmée dans le bloc{' '}
                    <button className="link-button" onClick={() => openBlockDetails(txState.blockNumber)}>
                      #{txState.blockNumber}
                    </button>
                  </p>
                )}
              </div>
            </section>
          </div>
        </section>

        <section className="card explorer-section">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Historique</p>
              <h2>Blockchain explorer embarqué</h2>
            </div>
            <button className="secondary-button" onClick={() => setExplorerOpen((open) => !open)}>
              {explorerOpen ? 'Masquer' : 'Afficher'}
            </button>
          </div>

          {explorerOpen && (
            <div className="explorer-content">
              {explorerLoading ? (
                <p>Chargement des derniers events Voted...</p>
              ) : explorerEvents.length === 0 ? (
                <p>Aucun vote trouvé sur la fenêtre inspectée.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Tx Hash</th>
                        <th>Bloc</th>
                        <th>Votant</th>
                        <th>Candidat</th>
                        <th>Heure</th>
                        <th>Gas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {explorerEvents.map((event, index) => (
                        <tr key={`${event.hash}-${index}`}>
                          <td>
                            <a href={`${EXPLORER_BASE_URL}/tx/${event.hash}`} target="_blank" rel="noreferrer">
                              {shortAddress(event.hash, 10, 6)}
                            </a>
                          </td>
                          <td>
                            <button className="link-button" onClick={() => openBlockDetails(event.blockNumber)}>
                              #{event.blockNumber}
                            </button>
                          </td>
                          <td>{shortAddress(event.voter, 10, 6)}</td>
                          <td>{event.candidateName}</td>
                          <td>
                            {event.timestamp
                              ? new Date(event.timestamp * 1000).toLocaleString('fr-FR')
                              : '—'}
                          </td>
                          <td>{event.gasUsed != null ? `${event.gasUsed.toLocaleString('fr-FR')} unités` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {blockModalOpen && (
        <div className="modal-backdrop" onClick={() => setBlockModalOpen(false)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <p className="section-kicker">Détail du bloc</p>
                <h2>{selectedBlock ? `Bloc #${selectedBlock.number}` : 'Bloc'}</h2>
              </div>
              <button className="secondary-button" onClick={() => setBlockModalOpen(false)}>
                Fermer
              </button>
            </div>

            {blockLoading ? (
              <p>Chargement du bloc...</p>
            ) : !selectedBlock ? (
              <p>Impossible de charger les informations du bloc.</p>
            ) : (
              <div className="block-grid">
                <div className="block-item">
                  <span>Timestamp</span>
                  <strong>{new Date(selectedBlock.timestamp * 1000).toLocaleString('fr-FR')}</strong>
                </div>
                <div className="block-item">
                  <span>Parent hash</span>
                  <strong>{shortAddress(selectedBlock.parentHash, 16, 12)}</strong>
                </div>
                <div className="block-item">
                  <span>Gas limit</span>
                  <strong>{selectedBlock.gasLimit?.toString?.() ?? '—'}</strong>
                </div>
                <div className="block-item">
                  <span>Gas utilisé</span>
                  <strong>{selectedBlock.gasUsed?.toString?.() ?? '—'}</strong>
                </div>
                <div className="block-item">
                  <span>Validateur / miner</span>
                  <strong>{shortAddress(selectedBlock.miner, 12, 10)}</strong>
                </div>
                <div className="block-item">
                  <span>Hash du bloc</span>
                  <strong>{shortAddress(selectedBlock.hash, 16, 12)}</strong>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default App