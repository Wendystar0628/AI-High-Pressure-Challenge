import Mathlib.Data.Nat.Squarefree
import Mathlib.FieldTheory.Finite.Basic

section Problem5Aux

private lemma geom_sum_zmod {p : ℕ} (ζ : ZMod p) (r : ℕ) :
    (ζ - 1) * (∑ j ∈ Finset.range r, ζ ^ j) = ζ ^ r - 1 := by
  induction r with
  | zero => simp
  | succ r ih =>
    rw [Finset.sum_range_succ, mul_add, ih]
    ring

private lemma divisors_prime_mul_of_not_dvd {q M : ℕ} (hq : q.Prime) (hM : 0 < M)
    (hnot : ¬ (q ∣ M)) :
    Disjoint M.divisors (M.divisors.image (q * ·)) ∧
      (q * M).divisors = M.divisors ∪ M.divisors.image (q * ·) := by
  have hdisj : Disjoint M.divisors (M.divisors.image (q * ·)) := by
    rw [Finset.disjoint_left]
    intro d hdM hdimg
    rcases Finset.mem_image.mp hdimg with ⟨d', _, rfl⟩
    exact hnot (dvd_trans (dvd_mul_right q d') (Nat.dvd_of_mem_divisors hdM))
  refine ⟨hdisj, ?_⟩
  ext d
  simp only [Finset.mem_union, Finset.mem_image, Nat.mem_divisors]
  have hqM_ne : q * M ≠ 0 := mul_ne_zero hq.ne_zero hM.ne'
  constructor
  · rintro ⟨hd_dvd, _⟩
    by_cases hqd : q ∣ d
    · rcases hqd with ⟨d', rfl⟩
      have hd'M : d' ∣ M := (Nat.mul_dvd_mul_iff_left hq.pos).mp hd_dvd
      exact Or.inr ⟨d', ⟨hd'M, hM.ne'⟩, rfl⟩
    · have hcop : d.Coprime q := (hq.coprime_iff_not_dvd.mpr hqd).symm
      exact Or.inl ⟨hcop.dvd_of_dvd_mul_left hd_dvd, hM.ne'⟩
  · rintro (⟨hdM, _⟩ | ⟨d', ⟨hd'M, _⟩, rfl⟩)
    · exact ⟨dvd_trans hdM (dvd_mul_left M q), hqM_ne⟩
    · exact ⟨mul_dvd_mul_left q hd'M, hqM_ne⟩

private lemma squarefree_card_divisors_pow_two :
    ∀ M : ℕ, 0 < M → Squarefree M → ∃ e : ℕ, M.divisors.card = 2 ^ e := by
  intro M
  induction M using Nat.strong_induction_on with
  | h M ih =>
    intro hM hsM
    by_cases hM1 : M = 1
    · subst hM1
      exact ⟨0, by simp⟩
    · have hM_gt1 : 1 < M := by omega
      let q := M.minFac
      have hq : q.Prime := Nat.minFac_prime (by omega)
      have hq_dvd : q ∣ M := Nat.minFac_dvd M
      rcases hq_dvd with ⟨M', hM_eq⟩
      have hM'_pos : 0 < M' := by
        by_contra! h0
        have : M' = 0 := by omega
        rw [this, mul_zero] at hM_eq
        omega
      have hM'_lt : M' < M := by
        rw [hM_eq]
        exact lt_mul_of_one_lt_left hM'_pos hq.one_lt
      have hs_qm : Squarefree (q * M') := hM_eq ▸ hsM
      have hsM' : Squarefree M' := hs_qm.of_mul_right
      have hnot_qM' : ¬ (q ∣ M') := by
        intro hqM'
        have hsq : q * q ∣ q * M' := mul_dvd_mul_left q hqM'
        exact hq.not_isUnit (hs_qm q hsq)
      obtain ⟨e, he⟩ := ih M' hM'_lt hM'_pos hsM'
      obtain ⟨hdisj, hdiv_eq⟩ := divisors_prime_mul_of_not_dvd hq hM'_pos hnot_qM'
      refine ⟨e + 1, ?_⟩
      rw [hM_eq, hdiv_eq, Finset.card_union_of_disjoint hdisj]
      have hinj : Set.InjOn (q * ·) (M'.divisors : Set ℕ) :=
        fun _ _ _ _ h => mul_left_cancel₀ hq.ne_zero h
      rw [Finset.card_image_of_injOn hinj, he, pow_succ]
      ring

private lemma zmod_pow_eq_one_of_primes {r : ℕ} (P : ℕ) :
    ∀ k : ℕ, 0 < k → (∀ q : ℕ, q.Prime → q ∣ k → (q : ZMod r) ^ P = 1) →
      (k : ZMod r) ^ P = 1 := by
  intro k
  induction k using Nat.strong_induction_on with
  | h k ih =>
    intro hk hprimes
    by_cases hk1 : k = 1
    · subst hk1
      simp
    · let q := k.minFac
      have hq : q.Prime := Nat.minFac_prime hk1
      have hq_dvd : q ∣ k := Nat.minFac_dvd k
      rcases hq_dvd with ⟨k', hk_eq⟩
      have hk'_pos : 0 < k' := by
        by_contra! h0
        have : k' = 0 := by omega
        rw [this, mul_zero] at hk_eq
        omega
      have hk'_lt : k' < k := by
        rw [hk_eq]
        exact lt_mul_of_one_lt_left hk'_pos hq.one_lt
      have hq1 : (q : ZMod r) ^ P = 1 := hprimes q hq ⟨k', hk_eq⟩
      have hk'1 : (k' : ZMod r) ^ P = 1 := ih k' hk'_lt hk'_pos fun q' hq' hq'k' =>
        hprimes q' hq' (hk_eq ▸ dvd_mul_of_dvd_right hq'k' q)
      rw [hk_eq, Nat.cast_mul, mul_pow, hq1, hk'1, mul_one]

private lemma problem5_aux (n p r m : ℕ) (hn : 0 < n) (hs : Squarefree n)
    (hr : r.Prime) (hf : r = 2 ^ (2 ^ m) + 1)
    (hp : p.Prime) (hpn : p ∣ n) (hpr : Nat.ModEq r p 1)
    (ha : ∀ x : ℤ, (n : ℤ) ∣ (∑ d ∈ n.divisors, x ^ d) - (n.divisors.card : ℤ) * x) :
    ∀ d ∈ n.divisors, Nat.ModEq r d 1 := by
  classical
  have : Fact p.Prime := ⟨hp⟩
  have : Fact r.Prime := ⟨hr⟩
  have h2m_pos : 1 ≤ 2 ^ m := Nat.one_le_pow m 2 (by omega)
  have h22m_ge2 : 2 ≤ 2 ^ (2 ^ m) := by
    calc 2 = 2 ^ 1 := rfl
      _ ≤ 2 ^ (2 ^ m) := Nat.pow_le_pow_right (by omega) h2m_pos
  have hr_ge3 : 3 ≤ r := by omega
  have hp_ge2 : 2 ≤ p := hp.two_le
  have hr_dvd_p1 : r ∣ p - 1 := (Nat.modEq_iff_dvd' (by omega)).mp hpr.symm
  have hp1_pos : 0 < p - 1 := by omega
  have hr_le_p1 : r ≤ p - 1 := Nat.le_of_dvd hp1_pos hr_dvd_p1
  have hp_ge4 : 4 ≤ p := by omega
  have hr_lt_p : r < p := by omega
  have hr_ne_zero_p : (r : ZMod p) ≠ 0 := by
    rw [Ne, ZMod.natCast_eq_zero_iff]
    intro hdvd
    have := Nat.le_of_dvd (by omega) hdvd
    omega
  -- Element ζ ∈ ZMod p of multiplicative order r
  obtain ⟨g, hg⟩ := IsCyclic.exists_generator (α := (ZMod p)ˣ)
  have hord_g : orderOf g = p - 1 := by
    rw [orderOf_eq_card_of_forall_mem_zpowers hg, Nat.card_eq_fintype_card, ZMod.card_units p]
  rcases hr_dvd_p1 with ⟨t, ht⟩
  have ht_pos : 0 < t := by
    by_contra! h0
    have : t = 0 := by omega
    rw [this, mul_zero] at ht
    omega
  have ht_lt_p1 : t < p - 1 := by
    rw [ht]
    exact lt_mul_of_one_lt_left ht_pos (by omega)
  let u : (ZMod p)ˣ := g ^ t
  have hu_pow_r : u ^ r = 1 := by
    dsimp only [u]
    rw [← pow_mul, mul_comm, ← ht, ← hord_g, pow_orderOf_eq_one]
  have hu_ne_one : u ≠ 1 := by
    intro hu1
    have hdvd : orderOf g ∣ t := orderOf_dvd_of_pow_eq_one hu1
    rw [hord_g] at hdvd
    have := Nat.le_of_dvd ht_pos hdvd
    omega
  have hord_u : orderOf u = r := orderOf_eq_prime hu_pow_r hu_ne_one
  let ζ : ZMod p := (u : ZMod p)
  have hζ_pow_r : ζ ^ r = 1 := by
    dsimp only [ζ]
    rw [← Units.val_pow_eq_pow_val, hu_pow_r, Units.val_one]
  have hζ_pow_eq_one : ∀ a : ℕ, ζ ^ a = 1 ↔ r ∣ a := by
    intro a
    dsimp only [ζ]
    rw [← Units.val_pow_eq_pow_val, ← Units.val_one, ← Units.ext_iff,
      ← orderOf_dvd_iff_pow_eq_one, hord_u]
  have hgeom : ∀ a : ℕ, (∑ j ∈ Finset.range r, (ζ ^ a) ^ j) =
      if r ∣ a then (r : ZMod p) else 0 := by
    intro a
    split_ifs with hdvd
    · have h1 : ζ ^ a = 1 := (hζ_pow_eq_one a).mpr hdvd
      simp [h1]
    · have hne1 : ζ ^ a ≠ 1 := mt (hζ_pow_eq_one a).mp hdvd
      have hsub_ne : ζ ^ a - 1 ≠ 0 := sub_ne_zero.mpr hne1
      have hid := geom_sum_zmod (ζ ^ a) r
      have hpow1 : (ζ ^ a) ^ r = 1 := by
        rw [← pow_mul, mul_comm, pow_mul, hζ_pow_r, one_pow]
      rw [hpow1, sub_self] at hid
      exact (mul_eq_zero.mp hid).resolve_left hsub_ne
  -- Relation in ZMod p from ha
  have heq_zmodp : ∀ j : ℕ, (∑ d ∈ n.divisors, (ζ ^ j) ^ d) =
      (n.divisors.card : ZMod p) * ζ ^ j := by
    intro j
    let ω : ZMod p := ζ ^ j
    have hdvd_n := ha (ω.val : ℤ)
    have hdvd_p : (p : ℤ) ∣ (∑ d ∈ n.divisors, (ω.val : ℤ) ^ d) -
        (n.divisors.card : ℤ) * (ω.val : ℤ) :=
      dvd_trans (Int.natCast_dvd_natCast.mpr hpn) hdvd_n
    have hz0 : (((∑ d ∈ n.divisors, (ω.val : ℤ) ^ d) -
        (n.divisors.card : ℤ) * (ω.val : ℤ) : ℤ) : ZMod p) = 0 :=
      (ZMod.intCast_zmod_eq_zero_iff_dvd _ p).mpr hdvd_p
    push_cast at hz0
    rw [ZMod.natCast_zmod_val] at hz0
    exact sub_eq_zero.mp hz0
  -- Divisibility p ∣ N_c for all c ≠ 1 in ZMod r
  have hp_dvd_Nc : ∀ c : ZMod r, c ≠ 1 →
      p ∣ (n.divisors.filter (fun d : ℕ => (d : ZMod r) = c)).card := by
    intro c hc1
    let c' : ℕ := r - c.val
    have hc_lt : c.val < r := ZMod.val_lt c
    have hdvd_iff : ∀ d : ℕ, r ∣ d + c' ↔ (d : ZMod r) = c := by
      intro d
      rw [← ZMod.natCast_eq_zero_iff]
      have hc'_cast : (c' : ZMod r) = -c := by
        dsimp only [c']
        rw [Nat.cast_sub hc_lt.le]
        simp
      rw [Nat.cast_add, hc'_cast, ← sub_eq_add_neg, sub_eq_zero]
    have hsum_j : ∀ j ∈ Finset.range r,
        (∑ d ∈ n.divisors, (ζ ^ (d + c')) ^ j) =
        (n.divisors.card : ZMod p) * (ζ ^ (1 + c')) ^ j := by
      intro j _
      have hmul := congrArg (· * (ζ ^ j) ^ c') (heq_zmodp j)
      rw [Finset.sum_mul] at hmul
      have h_lhs : (∑ d ∈ n.divisors, (ζ ^ j) ^ d * (ζ ^ j) ^ c') =
          ∑ d ∈ n.divisors, (ζ ^ (d + c')) ^ j := by
        refine Finset.sum_congr rfl fun d _ => ?_
        rw [← pow_add, ← pow_mul, ← pow_mul, mul_comm j]
      have h_rhs : (n.divisors.card : ZMod p) * ζ ^ j * (ζ ^ j) ^ c' =
          (n.divisors.card : ZMod p) * (ζ ^ (1 + c')) ^ j := by
        have hpow : ζ ^ j * (ζ ^ j) ^ c' = (ζ ^ (1 + c')) ^ j := by
          rw [← pow_mul, ← pow_mul, ← pow_add]
          congr 1
          ring
        rw [mul_assoc, hpow]
      rw [h_lhs, h_rhs] at hmul
      exact hmul
    have htotal := Finset.sum_congr rfl hsum_j
    rw [Finset.sum_comm, ← Finset.mul_sum] at htotal
    simp_rw [hgeom, hdvd_iff] at htotal
    have h1_ne_c : ¬ ((1 : ℕ) : ZMod r) = c := by
      rw [Nat.cast_one]
      exact hc1.symm
    simp only [h1_ne_c, ↓reduceIte, mul_zero] at htotal
    have hlhs_eq : (∑ x ∈ n.divisors, if (x : ZMod r) = c then (r : ZMod p) else 0) =
        (r : ZMod p) * ((n.divisors.filter (fun d : ℕ => (d : ZMod r) = c)).card : ZMod p) := by
      rw [Finset.card_filter, Nat.cast_sum]
      simp_rw [Nat.cast_ite, Nat.cast_one, Nat.cast_zero, Finset.mul_sum, mul_ite,
        mul_one, mul_zero]
    rw [hlhs_eq] at htotal
    have hcard0 : ((n.divisors.filter (fun d : ℕ => (d : ZMod r) = c)).card : ZMod p) = 0 :=
      (mul_eq_zero.mp htotal).resolve_left hr_ne_zero_p
    exact (ZMod.natCast_eq_zero_iff _ _).mp hcard0
  -- Helper: p cannot divide 2 ^ e
  have hp_not_dvd_pow2 : ∀ e : ℕ, ¬ (p ∣ 2 ^ e) := by
    intro e hdvd
    have hp2 : p ∣ 2 := hp.dvd_of_dvd_pow hdvd
    have := Nat.le_of_dvd (by omega) hp2
    omega
  -- Step A: ¬ (r ∣ n)
  have hnot_rn : ¬ (r ∣ n) := by
    intro hrn
    rcases hrn with ⟨M, hn_eq⟩
    have hM_pos : 0 < M := by
      by_contra! h0
      have : M = 0 := by omega
      rw [this, mul_zero] at hn_eq
      omega
    have hs_rM : Squarefree (r * M) := hn_eq ▸ hs
    have hsM : Squarefree M := hs_rM.of_mul_right
    have hnot_rM : ¬ (r ∣ M) := by
      intro hrM
      exact hr.not_isUnit (hs_rM r (mul_dvd_mul_left r hrM))
    obtain ⟨_, hdiv_eq⟩ := divisors_prime_mul_of_not_dvd hr hM_pos hnot_rM
    have hfilt0 : n.divisors.filter (fun d : ℕ => (d : ZMod r) = 0) = M.divisors.image (r * ·) := by
      ext d
      rw [hn_eq, hdiv_eq]
      simp only [Finset.mem_filter, Finset.mem_union, Finset.mem_image, ZMod.natCast_eq_zero_iff]
      constructor
      · rintro ⟨hdM | ⟨d', hd'M, rfl⟩, hrd⟩
        · exact False.elim (hnot_rM (dvd_trans hrd (Nat.dvd_of_mem_divisors hdM)))
        · exact ⟨d', hd'M, rfl⟩
      · rintro ⟨d', hd'M, rfl⟩
        exact ⟨Or.inr ⟨d', hd'M, rfl⟩, dvd_mul_right r d'⟩
    have hinj : Set.InjOn (r * ·) (M.divisors : Set ℕ) :=
      fun _ _ _ _ h => mul_left_cancel₀ hr.ne_zero h
    have hcard0 : (n.divisors.filter (fun d : ℕ => (d : ZMod r) = 0)).card = M.divisors.card := by
      rw [hfilt0, Finset.card_image_of_injOn hinj]
    obtain ⟨e, he⟩ := squarefree_card_divisors_pow_two M hM_pos hsM
    have hp_dvd0 := hp_dvd_Nc 0 zero_ne_one
    rw [hcard0, he] at hp_dvd0
    exact hp_not_dvd_pow2 e hp_dvd0
  -- Step B: Fermat's Little Theorem mod r and minimal 2-power exponent s
  have hex_s : ∃ k : ℕ, ∀ d ∈ n.divisors, (d : ZMod r) ^ (2 ^ k) = 1 := by
    refine ⟨2 ^ m, fun d hd => ?_⟩
    have hd_dvd : d ∣ n := Nat.dvd_of_mem_divisors hd
    have hnot_rd : ¬ (r ∣ d) := fun hrd => hnot_rn (dvd_trans hrd hd_dvd)
    have hd_ne0 : (d : ZMod r) ≠ 0 := by rwa [Ne, ZMod.natCast_eq_zero_iff]
    have hr1 : r - 1 = 2 ^ (2 ^ m) := by omega
    rw [← hr1]
    exact ZMod.pow_card_sub_one_eq_one hd_ne0
  by_contra! h_not_all
  obtain ⟨d_bad, hd_bad_mem, hd_bad⟩ := h_not_all
  let s := Nat.find hex_s
  have hs_spec : ∀ d ∈ n.divisors, (d : ZMod r) ^ (2 ^ s) = 1 := Nat.find_spec hex_s
  have hs_pos : 0 < s := by
    by_contra! hs0
    have hs_eq0 : s = 0 := by omega
    have h1 := hs_spec d_bad hd_bad_mem
    rw [hs_eq0, pow_zero, pow_one] at h1
    have hmod : Nat.ModEq r d_bad 1 := (ZMod.natCast_eq_natCast_iff d_bad 1 r).mp (by simpa using h1)
    exact hd_bad hmod
  have hs_min : ¬ (∀ d ∈ n.divisors, (d : ZMod r) ^ (2 ^ (s - 1)) = 1) :=
    Nat.find_min hex_s (by omega)
  push Not at hs_min
  obtain ⟨d₀, hd₀_mem, hd₀_ne1⟩ := hs_min
  let P := 2 ^ (s - 1)
  have h2s_eq : 2 ^ s = P * 2 := by
    have : s = (s - 1) + 1 := by omega
    rw [this, pow_succ]
  -- Find a prime factor q of d₀ (hence of n) with (q : ZMod r) ^ P ≠ 1
  have hd₀_pos : 0 < d₀ := Nat.pos_of_mem_divisors hd₀_mem
  have hex_q : ∃ q : ℕ, q.Prime ∧ q ∣ d₀ ∧ (q : ZMod r) ^ P ≠ 1 := by
    by_contra! hall_q
    exact hd₀_ne1 (zmod_pow_eq_one_of_primes P d₀ hd₀_pos hall_q)
  obtain ⟨q, hq_prime, hq_d₀, hq_ne1⟩ := hex_q
  have hqn : q ∣ n := dvd_trans hq_d₀ (Nat.dvd_of_mem_divisors hd₀_mem)
  have hq_mem_div : q ∈ n.divisors := Nat.mem_divisors.mpr ⟨hqn, hn.ne'⟩
  have hsq_one : ∀ d ∈ n.divisors, ((d : ZMod r) ^ P) ^ 2 = 1 := by
    intro d hd
    rw [← pow_mul, ← h2s_eq]
    exact hs_spec d hd
  have hq_neg1 : (q : ZMod r) ^ P = -1 :=
    (sq_eq_one_iff.mp (hsq_one q hq_mem_div)).resolve_left hq_ne1
  have hneg1_ne1 : (-1 : ZMod r) ≠ 1 := by
    intro h_eq
    have h20 : (2 : ZMod r) = 0 := by
      have : (1 : ZMod r) + 1 = 0 := by
        calc (1 : ZMod r) + 1 = -1 + 1 := by rw [h_eq]
          _ = 0 := neg_add_cancel 1
      simpa [one_add_one_eq_two] using this
    have hrdvd2 : r ∣ 2 := (ZMod.natCast_eq_zero_iff 2 r).mp h20
    have := Nat.le_of_dvd (by omega) hrdvd2
    omega
  -- Split n = q * M
  rcases hqn with ⟨M, hn_eq⟩
  have hM_pos : 0 < M := by
    by_contra! h0
    have : M = 0 := by omega
    rw [this, mul_zero] at hn_eq
    omega
  have hs_qM : Squarefree (q * M) := hn_eq ▸ hs
  have hsM : Squarefree M := hs_qM.of_mul_right
  have hnot_qM : ¬ (q ∣ M) := by
    intro hqM
    exact hq_prime.not_isUnit (hs_qM q (mul_dvd_mul_left q hqM))
  obtain ⟨hdisj_qM, hdiv_qM⟩ := divisors_prime_mul_of_not_dvd hq_prime hM_pos hnot_qM
  let W : Finset ℕ := n.divisors.filter (fun d : ℕ => (d : ZMod r) ^ P = -1)
  let M₁ : Finset ℕ := M.divisors.filter (fun d : ℕ => (d : ZMod r) ^ P = -1)
  let M₂ : Finset ℕ := M.divisors.filter (fun d : ℕ => (d : ZMod r) ^ P ≠ -1)
  have hW_eq : W = M₁ ∪ M₂.image (q * ·) := by
    ext d
    have hdiv_n : n.divisors = M.divisors ∪ M.divisors.image (q * ·) := hn_eq ▸ hdiv_qM
    simp only [W, M₁, M₂, hdiv_n, Finset.mem_filter, Finset.mem_union, Finset.mem_image]
    constructor
    · rintro ⟨hdM | ⟨d', hd'M, rfl⟩, hdP⟩
      · exact Or.inl ⟨hdM, hdP⟩
      · right
        refine ⟨d', ⟨hd'M, ?_⟩, rfl⟩
        intro hd'neg1
        rw [Nat.cast_mul, mul_pow, hq_neg1, hd'neg1, neg_mul_neg, one_mul] at hdP
        exact hneg1_ne1 hdP.symm
    · rintro (⟨hdM, hdP⟩ | ⟨d', ⟨hd'M, hd'not⟩, rfl⟩)
      · exact ⟨Or.inl hdM, hdP⟩
      · refine ⟨Or.inr ⟨d', hd'M, rfl⟩, ?_⟩
        have hd'_in_n : d' ∈ n.divisors := by
          rw [hdiv_n]
          exact Finset.mem_union_left _ hd'M
        have hd'1 : (d' : ZMod r) ^ P = 1 :=
          (sq_eq_one_iff.mp (hsq_one d' hd'_in_n)).resolve_right hd'not
        rw [Nat.cast_mul, mul_pow, hq_neg1, hd'1, mul_one]
  have hdisj_W : Disjoint M₁ (M₂.image (q * ·)) :=
    Finset.disjoint_of_subset_left (Finset.filter_subset _ _)
      (Finset.disjoint_of_subset_right (Finset.image_subset_image (Finset.filter_subset _ _))
        hdisj_qM)
  have hinj_q : Set.InjOn (q * ·) (M₂ : Set ℕ) :=
    fun _ _ _ _ h => mul_left_cancel₀ hq_prime.ne_zero h
  have hM_union : M₁ ∪ M₂ = M.divisors := by
    ext d
    simp only [M₁, M₂, Finset.mem_union, Finset.mem_filter]
    by_cases hd : (d : ZMod r) ^ P = -1 <;> simp [hd]
  have hM_disj : Disjoint M₁ M₂ := by
    rw [Finset.disjoint_left]
    intro d h1 h2
    exact (Finset.mem_filter.mp h2).2 (Finset.mem_filter.mp h1).2
  have hW_card : W.card = M.divisors.card := by
    rw [hW_eq, Finset.card_union_of_disjoint hdisj_W, Finset.card_image_of_injOn hinj_q,
      ← Finset.card_union_of_disjoint hM_disj, hM_union]
  -- Partition W by residue class c ∈ ZMod r with c ^ P = -1
  let Cset : Finset (ZMod r) := Finset.univ.filter (fun c : ZMod r => c ^ P = -1)
  let N : ZMod r → Finset ℕ := fun c => n.divisors.filter (fun d : ℕ => (d : ZMod r) = c)
  have hW_biUnion : W = Cset.biUnion N := by
    ext d
    simp only [W, Cset, N, Finset.mem_biUnion, Finset.mem_filter, Finset.mem_univ, true_and]
    constructor
    · rintro ⟨hd_mem, hdP⟩
      exact ⟨(d : ZMod r), hdP, hd_mem, rfl⟩
    · rintro ⟨c, hcP, hd_mem, hdc⟩
      rw [hdc]
      exact ⟨hd_mem, hcP⟩
  have hN_pw_disj : (Cset : Set (ZMod r)).PairwiseDisjoint N := by
    intro c₁ _ c₂ _ hne
    rw [Function.onFun, Finset.disjoint_left]
    intro d hd₁ hd₂
    have h1 := (Finset.mem_filter.mp hd₁).2
    have h2 := (Finset.mem_filter.mp hd₂).2
    exact hne (h1.symm.trans h2)
  have hp_dvd_W : p ∣ W.card := by
    rw [hW_biUnion, Finset.card_biUnion hN_pw_disj]
    refine Finset.dvd_sum fun c hc => ?_
    have hcP : c ^ P = -1 := (Finset.mem_filter.mp hc).2
    have hc_ne1 : c ≠ 1 := by
      intro hc1
      rw [hc1, one_pow] at hcP
      exact hneg1_ne1 hcP.symm
    exact hp_dvd_Nc c hc_ne1
  obtain ⟨e, he⟩ := squarefree_card_divisors_pow_two M hM_pos hsM
  rw [hW_card, he] at hp_dvd_W
  exact hp_not_dvd_pow2 e hp_dvd_W

end Problem5Aux

theorem problem5 (n p r m : ℕ) (hn : 0 < n) (hs : Squarefree n)
    (hr : r.Prime) (hf : r = 2 ^ (2 ^ m) + 1)
    (hp : p.Prime) (hpn : p ∣ n) (hpr : Nat.ModEq r p 1)
    (ha : ∀ x : ℤ, (n : ℤ) ∣ (∑ d ∈ n.divisors, x ^ d) - (n.divisors.card : ℤ) * x) :
    ∀ d ∈ n.divisors, Nat.ModEq r d 1 := by
  exact problem5_aux n p r m hn hs hr hf hp hpn hpr ha
