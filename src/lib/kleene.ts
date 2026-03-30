/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { NFA, StateId, Symbol } from '../types';

/**
 * Computes the Kleene Star closure of an NFA according to the construction:
 * 1. Add a new initial state 's' and a new final state 'f'.
 * 2. 's' is the new start state.
 * 3. 'f' is the new final state.
 * 4. To accept ε, 's' is also a final state.
 * 5. For each transition (q, a, q') where q' is a final state in the original NFA:
 *    - Add transitions (q, a, q0) for all original start states q0.
 *    - Add transition (q, a, f).
 * 6. The new start state 's' mimics the original start states:
 *    - For each q0 in Q0 and transition (q0, a, q'), add (s, a, q').
 *    - If q' is a final state, also add (s, a, q0) for all q0 in Q0 and (s, a, f).
 */
export function kleeneStarNFA(nfa: NFA): NFA {
  const q_new: StateId = 'q_new';
  
  // Ensure new state name is unique
  let newNodeName = q_new;
  while (nfa.states.includes(newNodeName)) newNodeName += '_';

  const newStates = [newNodeName, ...nfa.states];
  const transitions: Record<StateId, Record<Symbol, StateId[]>> = {};

  // Initialize transitions
  for (const state of newStates) {
    transitions[state] = {};
    for (const sym of nfa.alphabet) {
      transitions[state][sym] = [];
    }
  }

  // Copy original transitions and apply rules
  for (const q of nfa.states) {
    for (const a of nfa.alphabet) {
      const targets = nfa.transitions[q]?.[a] || [];
      const newTargets = [...targets];
      
      const hitsFinal = targets.some(t => nfa.finalStates.includes(t));
      if (hitsFinal) {
        // Rule: for each transition leading to a final state add a transition with the same letter to all initial states
        for (const q0 of nfa.startStates) {
          newTargets.push(q0);
        }
      }
      transitions[q][a] = Array.from(new Set(newTargets));
    }
  }

  // The new state 'q_new' has no outgoing transitions (already initialized to empty)

  // Start states: original ones + the new one
  const startStates = [...nfa.startStates, newNodeName];
  // Final states: original ones + the new one
  const finalStates = [...nfa.finalStates, newNodeName];

  return {
    states: newStates,
    alphabet: nfa.alphabet,
    transitions,
    startStates: Array.from(new Set(startStates)),
    finalStates: Array.from(new Set(finalStates))
  };
}
