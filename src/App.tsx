/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Play, ChevronRight, RotateCcw, Info, Settings2, Download, Upload, Sigma, Languages, Check, X, StepForward } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { NFA, StateId, Symbol } from './types';
import { kleeneStarNFA } from './lib/kleene';
import AutomatonGraph from './components/AutomatonGraph';

const DEFAULT_NFA: NFA = {
  states: ['q0', 'q1'],
  alphabet: ['a', 'b'],
  transitions: {
    'q0': { 'a': ['q1'], 'b': ['q0'] },
    'q1': { 'a': [], 'b': [] }
  },
  startStates: ['q0'],
  finalStates: ['q1']
};

export default function App() {
  const { t, i18n } = useTranslation();
  const [nfa, setNfa] = useState<NFA>(DEFAULT_NFA);

  const [activeTab, setActiveTab] = useState<'edit' | 'construct' | 'result'>('edit');
  const [showAddSymbolInput, setShowAddSymbolInput] = useState(false);
  const [newSymbolValue, setNewSymbolValue] = useState('');
  
  // Construction state
  const [resultNfa, setResultNfa] = useState<NFA | null>(null);
  const [constructionPhase, setConstructionPhase] = useState<'idle' | 'merging' | 'linking' | 'finished'>('idle');
  const [currentLinkIndex, setCurrentLinkIndex] = useState(0);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Simulation state
  const [simWord, setSimWord] = useState('');
  const [simStep, setSimStep] = useState(0);
  const [activeStates, setActiveStates] = useState<StateId[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  const startSimulation = () => {
    if (!resultNfa) return;
    setActiveStates(resultNfa.startStates);
    setSimStep(0);
    setIsSimulating(true);
  };

  const stepSimulation = () => {
    if (!resultNfa || !isSimulating || simStep >= simWord.length) return;
    
    const symbol = simWord[simStep];
    const nextStates = new Set<StateId>();
    
    activeStates.forEach(stateId => {
      const targets = resultNfa.transitions[stateId]?.[symbol] || [];
      targets.forEach(t => nextStates.add(t));
    });
    
    setActiveStates(Array.from(nextStates));
    setSimStep(prev => prev + 1);
  };

  const resetSimulation = () => {
    setIsSimulating(false);
    setSimStep(0);
    setActiveStates([]);
  };

  const resetConstruction = () => {
    setResultNfa(null);
    setConstructionPhase('idle');
    setCurrentLinkIndex(0);
    setFeedback(null);
  };

  const startConstruction = () => {
    // Initial merge: add a single new state 'q_new'
    const q_new: StateId = 'q_new';
    
    // Ensure new state name is unique
    let newNodeName = q_new;
    while (nfa.states.includes(newNodeName)) newNodeName += '_';

    const newStates = [newNodeName, ...nfa.states];
    const alphabet = [...nfa.alphabet];
    
    const transitions: Record<StateId, Record<Symbol, StateId[]>> = {};
    for (const state of newStates) {
      transitions[state] = {};
      for (const sym of alphabet) transitions[state][sym] = [];
    }

    // Copy original transitions
    for (const q of nfa.states) {
      for (const a of nfa.alphabet) {
        transitions[q][a] = [...(nfa.transitions[q]?.[a] || [])];
      }
    }

    // The new state 'newNodeName' has no outgoing transitions

    // Start states: original ones + the new one
    const startStates = [...nfa.startStates, newNodeName];
    // Final states: original ones + the new one
    const finalStates = [...nfa.finalStates, newNodeName];

    setResultNfa({
      states: newStates,
      alphabet,
      transitions,
      startStates,
      finalStates
    });
    setConstructionPhase('merging');
  };

  const stepToLinking = () => {
    setConstructionPhase('linking');
    setCurrentLinkIndex(0);
  };

  const stepLinking = () => {
    if (!resultNfa) return;

    // Find all (q, a) in original NFA that hit a final state
    const links: { q: StateId, a: Symbol }[] = [];
    for (const q of nfa.states) {
      for (const a of nfa.alphabet) {
        const targets = nfa.transitions[q]?.[a] || [];
        if (targets.some(t => nfa.finalStates.includes(t))) {
          links.push({ q, a });
        }
      }
    }

    if (currentLinkIndex < links.length) {
      const { q, a } = links[currentLinkIndex];
      setResultNfa(prev => {
        if (!prev) return null;
        const newTransitions = { ...prev.transitions };
        newTransitions[q] = { ...newTransitions[q] };
        
        // Rule: add transition to all original initial states
        newTransitions[q][a] = Array.from(new Set([
          ...newTransitions[q][a], 
          ...nfa.startStates
        ]));
        return { ...prev, transitions: newTransitions };
      });
      setCurrentLinkIndex(prev => prev + 1);
    } else {
      setConstructionPhase('finished');
    }
  };

  const runToCompletion = () => {
    const result = kleeneStarNFA(nfa);
    setResultNfa(result);
    setConstructionPhase('finished');
  };

  const reasonTransitionsNfa1 = useMemo(() => {
    if (constructionPhase !== 'linking') return [];
    const links: { q: StateId, a: Symbol }[] = [];
    for (const q of nfa.states) {
      for (const a of nfa.alphabet) {
        const targets = nfa.transitions[q]?.[a] || [];
        if (targets.some(t => nfa.finalStates.includes(t))) {
          links.push({ q, a });
        }
      }
    }
    
    if (currentLinkIndex > 0 && currentLinkIndex <= links.length) {
      const { q, a } = links[currentLinkIndex - 1];
      const targets = nfa.transitions[q]?.[a] || [];
      return targets
        .filter(t => nfa.finalStates.includes(t))
        .map(t => ({ from: q, to: t, label: a, color: "#fbbc33" }));
    }
    return [];
  }, [constructionPhase, currentLinkIndex, nfa]);

  const resultHighlightedTransitions = useMemo(() => {
    if (constructionPhase !== 'linking' || !resultNfa) return [];
    const links: { q: StateId, a: Symbol }[] = [];
    for (const q of nfa.states) {
      for (const a of nfa.alphabet) {
        const targets = nfa.transitions[q]?.[a] || [];
        if (targets.some(t => nfa.finalStates.includes(t))) {
          links.push({ q, a });
        }
      }
    }
    
    const highlights: { from: string; to: string; label: string; color?: string }[] = [];
    
    if (currentLinkIndex > 0 && currentLinkIndex <= links.length) {
      const { q, a } = links[currentLinkIndex - 1];
      const newNodeName = resultNfa.states[0];
      
      // Add the "reason" transitions
      const targets = nfa.transitions[q]?.[a] || [];
      targets
        .filter(t => nfa.finalStates.includes(t))
        .forEach(t => {
          highlights.push({ from: q, to: t, label: a, color: "#fbbc33" });
        });

      // Add the "new" transitions back to start states
      nfa.startStates.forEach(s => {
        highlights.push({ from: q, to: s, label: a, color: "#e4003a" });
      });
    }
    return highlights;
  }, [constructionPhase, resultNfa, currentLinkIndex, nfa]);

  // NFA Editor helpers
  const addState = () => {
    const prefix = 'q';
    let index = nfa.states.length;
    let newId = `${prefix}${index}`;
    while (nfa.states.includes(newId)) {
      index++;
      newId = `${prefix}${index}`;
    }
    setNfa(prev => ({
      ...prev,
      states: [...prev.states, newId],
      transitions: { ...prev.transitions, [newId]: {} }
    }));
  };

  const removeState = (id: string) => {
    setNfa(prev => {
      const newStates = prev.states.filter(s => s !== id);
      const newTransitions = { ...prev.transitions };
      delete newTransitions[id];
      // Clean up references in other transitions
      Object.keys(newTransitions).forEach(s => {
        Object.keys(newTransitions[s]).forEach(sym => {
          newTransitions[s][sym] = newTransitions[s][sym].filter(target => target !== id);
        });
      });
      return {
        ...prev,
        states: newStates,
        transitions: newTransitions,
        startStates: prev.startStates.filter(s => s !== id),
        finalStates: prev.finalStates.filter(s => s !== id)
      };
    });
  };

  const addSymbol = () => {
    if (newSymbolValue && !nfa.alphabet.includes(newSymbolValue)) {
      setNfa(prev => ({
        ...prev,
        alphabet: [...prev.alphabet, newSymbolValue]
      }));
      setNewSymbolValue('');
      setShowAddSymbolInput(false);
    }
  };

  const removeSymbol = (sym: string) => {
    setNfa(prev => {
      const newAlphabet = prev.alphabet.filter(s => s !== sym);
      const newTransitions = { ...prev.transitions };
      
      // Remove transitions for this symbol from all states
      Object.keys(newTransitions).forEach(stateId => {
        const stateTransitions = { ...newTransitions[stateId] };
        delete stateTransitions[sym];
        newTransitions[stateId] = stateTransitions;
      });

      return {
        ...prev,
        alphabet: newAlphabet,
        transitions: newTransitions
      };
    });
  };

  const toggleTransition = (from: string, sym: string, to: string) => {
    setNfa(prev => {
      const current = prev.transitions[from]?.[sym] || [];
      const next = current.includes(to) 
        ? current.filter(s => s !== to)
        : [...current, to];
      
      return {
        ...prev,
        transitions: {
          ...prev.transitions,
          [from]: {
            ...(prev.transitions[from] || {}),
            [sym]: next
          }
        }
      };
    });
  };

  return (
    <div className="min-h-screen bg-th-white text-th-black font-sans selection:bg-th-rot selection:text-th-white">
      {/* Header */}
      <header className="border-b border-th-black p-4 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-th-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex flex-col md:flex-row md:items-center gap-4 w-full md:w-auto">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight uppercase text-th-rot">{t('app_title')}</h1>
            <p className="text-[10px] md:text-xs opacity-60 font-mono mt-1">{t('app_subtitle')}</p>
          </div>
          
          <div className="flex items-center gap-2 bg-th-sand/10 border border-th-sand/30 px-2 py-1 rounded">
            <Languages size={14} className="text-th-dunkelblau" />
            <select 
              value={i18n.language} 
              onChange={(e) => i18n.changeLanguage(e.target.value)}
              className="bg-transparent text-[10px] font-bold uppercase focus:outline-none cursor-pointer"
            >
              <option value="en">EN</option>
              <option value="de">DE</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <button 
            onClick={() => setActiveTab('edit')}
            className={`flex-1 md:flex-none px-3 md:px-4 py-2 text-[10px] md:text-xs font-bold uppercase border border-th-black transition-colors ${activeTab === 'edit' ? 'bg-th-rot text-th-white border-th-rot' : 'hover:bg-th-rot hover:text-th-white hover:border-th-rot'}`}
          >
            {t('tab_define')}
          </button>
          <button 
            onClick={() => { setActiveTab('construct'); resetConstruction(); }}
            className={`flex-1 md:flex-none px-3 md:px-4 py-2 text-[10px] md:text-xs font-bold uppercase border border-th-black transition-colors ${activeTab === 'construct' ? 'bg-th-rot text-th-white border-th-rot' : 'hover:bg-th-rot hover:text-th-white hover:border-th-rot'}`}
          >
            {t('tab_construct')}
          </button>
          <button 
            onClick={() => { setActiveTab('result'); runToCompletion(); }}
            className={`flex-1 md:flex-none px-3 md:px-4 py-2 text-[10px] md:text-xs font-bold uppercase border border-th-black transition-colors ${activeTab === 'result' ? 'bg-th-rot text-th-white border-th-rot' : 'hover:bg-th-rot hover:text-th-white hover:border-th-rot'}`}
          >
            {t('tab_final')}
          </button>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Controls/Input */}
        <div className="lg:col-span-4 space-y-6">
          {activeTab === 'edit' && (
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <section className="bg-th-white p-6 border border-th-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="font-serif italic text-lg text-th-dunkelblau">{t('states_alphabet')}</h2>
                  <div className="flex gap-2">
                    <button onClick={addState} className="p-1 hover:bg-th-sand/20 rounded border border-th-sand/30" title={t('add_state')}><Plus size={16} /></button>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] uppercase font-bold opacity-50 block mb-2">{t('states')}</label>
                    <div className="flex flex-wrap gap-2">
                      {nfa.states.map(s => (
                        <div key={s} className="flex items-center gap-1 bg-th-sand/10 border border-th-sand/30 px-2 py-1 rounded text-xs">
                          <span>{s}</span>
                          <button onClick={() => removeState(s)} className="text-th-rot hover:text-th-rot/80"><Trash2 size={12} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-[10px] uppercase font-bold opacity-50 block">{t('alphabet')}</label>
                      <button 
                        onClick={() => setShowAddSymbolInput(!showAddSymbolInput)} 
                        className="p-1 hover:bg-th-sand/20 rounded border border-th-sand/30 flex items-center justify-center" 
                        title={t('add_symbol')}
                      >
                        <div className="relative flex items-center justify-center w-4 h-4">
                          <Sigma size={14} />
                          <Plus size={8} className="absolute -top-1 -right-1 text-th-black font-bold" />
                        </div>
                      </button>
                    </div>
                    
                    <AnimatePresence>
                      {showAddSymbolInput && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="mb-3 overflow-hidden"
                        >
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              value={newSymbolValue}
                              onChange={(e) => setNewSymbolValue(e.target.value)}
                              placeholder={t('enter_symbol')}
                              className="flex-1 text-xs px-2 py-1 border border-th-sand/30 rounded focus:outline-none focus:border-th-rot"
                              onKeyDown={(e) => e.key === 'Enter' && addSymbol()}
                              autoFocus
                            />
                            <button 
                              onClick={addSymbol}
                              className="px-3 py-1 bg-th-rot text-th-white text-[10px] font-bold uppercase rounded"
                            >
                              {t('add')}
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="flex flex-wrap gap-2">
                      {nfa.alphabet.map(s => (
                        <div key={s} className="flex items-center gap-1 bg-th-sand/10 border border-th-sand/30 px-2 py-1 rounded text-xs font-mono">
                          <span>{s}</span>
                          <button onClick={() => removeSymbol(s)} className="text-th-rot hover:text-th-rot/80 ml-1"><Trash2 size={12} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section className="bg-th-white p-6 border border-th-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <h2 className="font-serif italic text-lg mb-4 text-th-dunkelblau">{t('transitions')}</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr>
                        <th className="border border-th-sand/30 p-2 bg-th-sand/5">δ</th>
                        {nfa.alphabet.map(sym => (
                          <th key={sym} className="border border-th-sand/30 p-2 bg-th-sand/5 font-mono">{sym}</th>
                        ))}
                        <th className="border border-th-sand/30 p-2 bg-th-sand/5">{t('start')}</th>
                        <th className="border border-th-sand/30 p-2 bg-th-sand/5">{t('final')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nfa.states.map(from => (
                        <tr key={from}>
                          <td className="border border-th-sand/30 p-2 font-bold bg-th-sand/5">{from}</td>
                          {nfa.alphabet.map(sym => (
                            <td key={sym} className="border border-th-sand/30 p-1">
                              <div className="flex flex-wrap gap-1">
                                {nfa.states.map(to => (
                                  <button
                                    key={to}
                                    onClick={() => toggleTransition(from, sym, to)}
                                    className={`px-1 rounded border transition-colors ${nfa.transitions[from]?.[sym]?.includes(to) ? 'bg-th-rot text-th-white border-th-rot' : 'bg-th-white text-th-grau border-th-sand/30 hover:border-th-rot'}`}
                                  >
                                    {to}
                                  </button>
                                ))}
                              </div>
                            </td>
                          ))}
                          <td className="border border-th-sand/30 p-2 text-center">
                            <input 
                              type="checkbox" 
                              className="accent-th-rot"
                              checked={nfa.startStates.includes(from)}
                              onChange={() => {
                                setNfa(prev => ({
                                  ...prev,
                                  startStates: prev.startStates.includes(from) 
                                    ? prev.startStates.filter(s => s !== from)
                                    : [...prev.startStates, from]
                                }));
                              }}
                            />
                          </td>
                          <td className="border border-th-sand/30 p-2 text-center">
                            <input 
                              type="checkbox" 
                              className="accent-th-rot"
                              checked={nfa.finalStates.includes(from)}
                              onChange={() => {
                                setNfa(prev => ({
                                  ...prev,
                                  finalStates: prev.finalStates.includes(from) 
                                    ? prev.finalStates.filter(s => s !== from)
                                    : [...prev.finalStates, from]
                                }));
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </motion.div>
          )}

          {activeTab === 'construct' && (
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <section className="bg-th-white p-6 border border-th-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <h2 className="font-serif italic text-lg mb-4 text-th-dunkelblau">{t('construction_status')}</h2>
                
                <div className="space-y-4">
                  <div className="flex flex-col gap-2">
                    {constructionPhase === 'idle' && (
                      <button 
                        onClick={startConstruction}
                        className="w-full bg-th-rot text-th-white py-2 px-4 text-xs font-bold uppercase flex items-center justify-center gap-2 hover:bg-th-rot/90 transition-colors"
                      >
                        <Play size={16} /> {t('start')}
                      </button>
                    )}
                    
                    {constructionPhase === 'merging' && (
                      <button 
                        onClick={stepToLinking}
                        className="w-full bg-th-rot text-th-white py-2 px-4 text-xs font-bold uppercase flex items-center justify-center gap-2 hover:bg-th-rot/90 transition-colors"
                      >
                        <ChevronRight size={16} /> {t('next_step')}: {t('linking')}
                      </button>
                    )}

                    {constructionPhase === 'linking' && (
                      <button 
                        onClick={stepLinking}
                        className="w-full bg-th-rot text-th-white py-2 px-4 text-xs font-bold uppercase flex items-center justify-center gap-2 hover:bg-th-rot/90 transition-colors"
                      >
                        <ChevronRight size={16} /> {t('next_step')}
                      </button>
                    )}

                    <div className="flex gap-2">
                      <button 
                        onClick={runToCompletion}
                        className="flex-1 bg-th-white border border-th-black py-2 px-4 text-xs font-bold uppercase flex items-center justify-center gap-2 hover:bg-th-sand/10 transition-colors"
                      >
                        <Play size={16} /> {t('finish')}
                      </button>
                      <button 
                        onClick={resetConstruction}
                        className="bg-th-white border border-th-black py-2 px-4 text-xs font-bold uppercase flex items-center justify-center hover:bg-th-sand/10 transition-colors"
                      >
                        <RotateCcw size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-th-sand/30 pt-4 space-y-2">
                    <p className="text-[10px] uppercase font-bold opacity-50">{t('current_action')}</p>
                    <div className="text-xs space-y-2">
                      {constructionPhase === 'idle' && <p>{t('action_idle')}</p>}
                      {constructionPhase === 'merging' && <p>{t('action_merging')}</p>}
                      {constructionPhase === 'linking' && (
                        <>
                          <p>{t('action_linking', { step: currentLinkIndex })}</p>
                          <div className="mt-2 p-2 bg-th-sand/10 border-l-2 border-th-goldgelb text-[10px] italic">
                            {t('start_hits_final_note')}
                          </div>
                        </>
                      )}
                      {constructionPhase === 'finished' && <p>{t('action_finished')}</p>}
                    </div>
                  </div>
                </div>
              </section>

              {/* Removed Resulting NFA States section */}
            </motion.div>
          )}

          {activeTab === 'result' && (
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <section className="bg-th-white p-6 border border-th-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <h2 className="font-serif italic text-lg mb-4 text-th-dunkelblau">{t('dfa_summary')}</h2>
                <div className="space-y-4 text-xs">
                  <div className="flex justify-between">
                    <span className="opacity-50 uppercase font-bold">{t('total_states')}</span>
                    <span className="font-mono">{resultNfa?.states.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-50 uppercase font-bold">{t('transitions')}</span>
                    <span className="font-mono">
                      {resultNfa ? Object.values(resultNfa.transitions).reduce((acc, syms) => acc + Object.values(syms).reduce((a, b) => a + b.length, 0), 0) : 0}
                    </span>
                  </div>
                </div>
              </section>

              <div className="bg-th-dunkelblau text-th-white p-6 border border-th-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <h2 className="font-serif italic text-lg mb-4 text-th-sand">{t('theory_note_title')}</h2>
                <p className="text-xs leading-relaxed opacity-80">
                  {t('theory_note_text')}
                </p>
              </div>

              <section className="bg-th-white p-6 border border-th-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <h2 className="font-serif italic text-lg mb-4 text-th-dunkelblau">{t('simulation')}</h2>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold opacity-50 block">{t('input_word')}</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={simWord}
                        onChange={(e) => {
                          setSimWord(e.target.value);
                          resetSimulation();
                        }}
                        disabled={isSimulating}
                        placeholder="e.g. 'ababa'"
                        className="flex-1 text-xs px-2 py-1 border border-th-sand/30 rounded focus:outline-none focus:border-th-rot disabled:opacity-50"
                      />
                      {!isSimulating ? (
                        <button 
                          onClick={startSimulation}
                          disabled={!resultNfa}
                          className="px-3 py-1 bg-th-rot text-th-white text-[10px] font-bold uppercase rounded disabled:opacity-50"
                        >
                          {t('sim_start')}
                        </button>
                      ) : (
                        <button 
                          onClick={resetSimulation}
                          className="px-3 py-1 bg-th-grau text-th-white text-[10px] font-bold uppercase rounded"
                        >
                          {t('sim_reset')}
                        </button>
                      )}
                    </div>
                    {simWord.split('').some(char => !resultNfa?.alphabet.includes(char)) && (
                      <p className="text-[10px] text-th-rot italic mt-1">
                        {t('invalid_symbol', { symbol: simWord.split('').find(char => !resultNfa?.alphabet.includes(char)) })}
                      </p>
                    )}
                  </div>

                  {isSimulating && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                      <div className="flex items-center gap-2 overflow-x-auto py-2 border-b border-th-sand/10">
                        {simWord.split('').map((char, i) => (
                          <div 
                            key={i} 
                            className={`flex-none w-6 h-8 flex items-center justify-center border rounded font-mono text-xs transition-colors ${i === simStep - 1 ? 'bg-th-goldgelb border-th-goldgelb text-th-black' : i === simStep ? 'bg-th-rot/10 border-th-rot text-th-rot animate-pulse' : 'bg-th-white border-th-sand/30 opacity-50'}`}
                          >
                            {char}
                          </div>
                        ))}
                        {simWord.length === 0 && <span className="text-[10px] italic opacity-50">ε (empty word)</span>}
                      </div>

                      <div className="flex justify-between items-center">
                        <div className="text-[10px] uppercase font-bold opacity-50">
                          {simStep < simWord.length ? t('sim_running') : t('sim_finished')}
                        </div>
                        {simStep < simWord.length && (
                          <button 
                            onClick={stepSimulation}
                            className="flex items-center gap-1 bg-th-dunkelblau text-th-white px-3 py-1 rounded text-[10px] font-bold uppercase"
                          >
                            <StepForward size={12} /> {t('sim_step')}
                          </button>
                        )}
                      </div>

                      <div className="p-3 bg-th-sand/5 border border-th-sand/20 rounded space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] uppercase font-bold opacity-50">{t('active_states')}</span>
                          <span className="font-mono text-xs">{activeStates.length > 0 ? `{${activeStates.join(', ')}}` : t('empty_set')}</span>
                        </div>
                        
                        {simStep === simWord.length && (
                          <div className={`flex items-center justify-center gap-2 p-2 rounded font-bold uppercase text-xs ${activeStates.some(s => resultNfa?.finalStates.includes(s)) ? 'bg-th-mint/20 text-th-dunkelblau' : 'bg-th-rot/10 text-th-rot'}`}>
                            {activeStates.some(s => resultNfa?.finalStates.includes(s)) ? (
                              <><Check size={16} /> {t('accepted')}</>
                            ) : (
                              <><X size={16} /> {t('rejected')}</>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </div>
              </section>
            </motion.div>
          )}
        </div>

        {/* Right Column: Visualization */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-th-white p-6 border border-th-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] min-h-[700px] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-serif italic text-xl text-th-dunkelblau">{t('visualization')}</h2>
              <div className="flex items-center gap-4 text-[10px] font-bold uppercase opacity-50">
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#719cbf] border border-th-black"></div> {t('nfa1')}</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 bg-[#fbbc33]"></div> {t('reason')}</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 bg-[#e4003a]"></div> {t('new_link')}</div>
                {isSimulating && <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#fee2e2] border-[#ef4444] border"></div> {t('active_states')}</div>}
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-th-blaugrau/20 border border-th-dunkelblau"></div> {t('start')}</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full border-2 border-th-black"></div> {t('final')}</div>
              </div>
            </div>

            <div className="flex-1 flex flex-col gap-6 min-w-0 overflow-hidden">
              <div className="flex-1 flex flex-col min-w-0 space-y-2">
                <h3 className="text-[10px] uppercase font-bold opacity-50 text-th-dunkelblau">{t('nfa_input')}</h3>
                <div className="flex-1 min-h-0 min-w-0 bg-th-white border border-th-sand/20 rounded">
                  <AutomatonGraph 
                    states={nfa.states}
                    transitions={Object.entries(nfa.transitions).flatMap(([from, syms]) => 
                      Object.entries(syms).flatMap(([sym, tos]) => 
                        tos.map(to => ({ from, to, label: sym }))
                      )
                    )}
                    highlightedTransitions={reasonTransitionsNfa1}
                    startStates={nfa.startStates}
                    finalStates={nfa.finalStates}
                    height={325}
                    stateColor="#719cbf"
                  />
                </div>
              </div>

              {resultNfa && (
                <div className="flex-1 flex flex-col min-w-0 space-y-2">
                  <h3 className="text-[10px] uppercase font-bold opacity-50 text-th-dunkelblau">{t('dfa_construction')}</h3>
                  <div className="flex-1 min-h-0 min-w-0 bg-th-white border border-th-sand/20 rounded">
                    <AutomatonGraph 
                      states={resultNfa.states}
                      transitions={Object.entries(resultNfa.transitions).flatMap(([from, syms]) => 
                        Object.entries(syms).flatMap(([sym, tos]) => 
                          tos.map(to => ({ from, to, label: sym }))
                        )
                      )}
                      highlightedTransitions={resultHighlightedTransitions}
                      highlightedStates={activeStates}
                      startStates={resultNfa.startStates}
                      finalStates={resultNfa.finalStates}
                      height={325}
                      stateColor={(id) => nfa.states.includes(id) ? "#719cbf" : "#bda2c1"}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
