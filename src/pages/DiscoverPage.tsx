import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, Sparkles, X } from 'lucide-react'
import type { ChildProfile, ContentPackage } from '../domain/types'
import { ConceptService } from '../services/ConceptService'
import { ContentPackageService } from '../services/ContentPackageService'

export function DiscoverPage({ profile, onProfileUpdated }: { profile: ChildProfile; onProfileUpdated: () => Promise<void> }) {
  const [packages, setPackages] = useState<ContentPackage[]>([])
  const [progress, setProgress] = useState<Awaited<ReturnType<typeof ConceptService.getConceptsWithProgress>>>([])
  const [selected, setSelected] = useState<{ contentPackage: ContentPackage; discovery: ContentPackage['discoveries'][number] } | null>(null)
  useEffect(() => { void Promise.all([ContentPackageService.getPackages().then(setPackages), ConceptService.getConceptsWithProgress(profile.id).then(setProgress)]) }, [profile.id])
  const openDiscovery = async (contentPackage: ContentPackage, discovery: ContentPackage['discoveries'][number]) => {
    await ConceptService.markDiscoverySeen(profile.id, contentPackage.concept.id, discovery.id)
    setProgress(await ConceptService.getConceptsWithProgress(profile.id))
    setSelected({ contentPackage, discovery })
  }
  const completeDiscovery = async () => {
    if (!selected) return
    await ConceptService.completeDiscovery(profile.id, selected.contentPackage.concept.id, selected.discovery.id)
    await onProfileUpdated()
    setProgress(await ConceptService.getConceptsWithProgress(profile.id))
    setSelected(null)
  }
  const seen = progress.reduce((count, item) => count + item.progress.seenDiscoveries.length, 0)
  const total = packages.reduce((count, item) => count + item.discoveries.length, 0)
  return <div className="discover-page page-enter"><div className="page-title-row"><div><p className="eyebrow">NYFIKEN PÅ VÄRLDEN?</p><h1>Utforska & upptäck</h1><p className="page-subtitle">Små hemligheter gömmer sig överallt. Vad hittar du?</p></div><div className="discovery-counter"><span>🔭</span><strong>{seen}<small>/{total}</small></strong><span>upptäckta</span></div></div>
    <section className="discover-banner"><div className="banner-copy"><span className="banner-label"><Sparkles size={14} /> UPPTÄCKARUPPDRAG</span><h2>Världen är full av<br />små underverk.</h2><p>Varje kort rymmer något nytt att upptäcka. Tryck och se!</p><div className="banner-progress"><span><i style={{ width: `${total ? (seen / total) * 100 : 0}%` }} /></span><small>{seen} av {total} upptäckter</small></div></div><div className="banner-art" aria-hidden="true"><span>🔍</span><i>✦</i><b>✧</b><em>✳</em></div></section>
    {packages.map((contentPackage) => <section className="discovery-section" key={contentPackage.id}><div className="section-heading"><div><p className="eyebrow">{contentPackage.subject.name.toLocaleUpperCase('sv-SE')}</p><h2>{contentPackage.concept.title}</h2></div><span className="subject-chip">{contentPackage.concept.emoji} {contentPackage.discoveries.length} kort</span></div><div className="discovery-grid">
      {contentPackage.discoveries.map((discovery, index) => { const itemProgress = progress.find((item) => item.concept.id === contentPackage.concept.id)?.progress; const isSeen = itemProgress?.seenDiscoveries.includes(discovery.id) ?? false; const isCompleted = itemProgress?.completedDiscoveries?.includes(discovery.id) ?? false; return <button className={`discovery-card discovery-card-${index + 1}${isSeen ? ' seen' : ''}${isCompleted ? ' completed' : ''}`} key={discovery.id} onClick={() => void openDiscovery(contentPackage, discovery)}><span className="discovery-card-top"><span className="discovery-emoji">{discovery.emoji}</span><span className="discovery-number">{isCompleted ? '✓' : `0${index + 1}`}</span></span><strong>{discovery.title}</strong><p>{discovery.body}</p><span className="discovery-open">{isCompleted ? 'Klar · Läs igen' : isSeen ? 'Läs igen' : 'Upptäck'} <ArrowRight size={15} /></span></button> })}
    </div>{contentPackage.knowledgeCards?.length ? <div className="knowledge-card-section"><div className="section-heading"><div><p className="eyebrow">LÄR KÄNNA MER</p><h3>Kunskapskort</h3></div><span className="subject-chip">{contentPackage.knowledgeCards.length} kort</span></div><div className="knowledge-card-grid">{contentPackage.knowledgeCards.map((card) => <article className="knowledge-card" key={card.id}><div className="knowledge-card-heading"><span>{card.emoji ?? '📚'}</span><div><h4>{card.title}</h4><p>{card.description}</p></div></div><dl>{Object.entries(card.facts).map(([label, fact]) => <div key={label}><dt>{label}</dt><dd>{fact}</dd></div>)}</dl></article>)}</div></div> : null}</section>)}
    {!packages.length && <div className="empty-state"><span>🔭</span><h2>Fler upptäckter är på väg!</h2><p>Håll utkik efter nya äventyr.</p></div>}
    {selected && createPortal(<div className="modal-backdrop" role="presentation" onClick={() => setSelected(null)}><section className="discovery-modal" role="dialog" aria-modal="true" aria-label={selected.discovery.title} onClick={(event) => event.stopPropagation()}><button className="modal-close" aria-label="Stäng" onClick={() => setSelected(null)}><X size={20} /></button><div className="modal-emoji">{selected.discovery.emoji}</div><p className="eyebrow">EN LITEN UPPTÄCKT</p><h2>{selected.discovery.title}</h2><p>{selected.discovery.body}</p><button className="primary-button" onClick={() => void completeDiscovery()}>Vad spännande! <Sparkles size={17} /></button></section></div>, document.body)}
  </div>
}