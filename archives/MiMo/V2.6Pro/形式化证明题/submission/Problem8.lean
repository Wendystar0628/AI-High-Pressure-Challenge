theorem problem8 (n : ℕ) (hn : 1 ≤ n)
    (f : Fin (4 * n - 3) → ZMod n × ZMod n) :
    ∃ s : Finset (Fin (4 * n - 3)),
      s.card = n ∧ ∑ i ∈ s, f i = 0 := by
  sorry
