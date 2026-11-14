import Mathlib.Algebra.Polynomial.Roots
import Mathlib.Data.Finset.Lattice.Fold
import Mathlib.Data.Nat.Squarefree
import Mathlib.FieldTheory.Finite.Basic
import Mathlib.NumberTheory.Divisors

private lemma dvd_card_divisors_filter {n p r : ℕ} (hp : p.Prime)
    (hr : 3 ≤ r) (hrp : r ∣ p - 1) (hpn : p ∣ n)
    (ha : ∀ x : ℤ, (n : ℤ) ∣ (∑ d ∈ n.divisors, x ^ d) - (n.divisors.card : ℤ) * x)
    (P : ℕ → Prop) [DecidablePred P] (hP1 : ¬ P 1) :
    p ∣ (n.divisors.filter (fun d => P (d % r))).card := by
  have : Fact p.Prime := ⟨hp⟩
  have hp_ge4 : 4 ≤ p := by
    obtain ⟨k, hk⟩ := hrp
    have hp1 : 0 < p - 1 := Nat.sub_pos_of_lt hp.one_lt
    have hk_pos : 0 < k := by
      by_contra hk0
      simp only [not_lt, Nat.le_zero] at hk0
      rw [hk0, mul_zero] at hk
      omega
    have hk1 : 1 ≤ k := hk_pos
    have : r ≤ r * k := Nat.le_mul_of_pos_right r hk1
    omega
  have hp1_pos : 0 < p - 1 := by omega
  let exp : ℕ → ℕ := fun d => (d - 1) % (p - 1) + 1
  have hexp_pos : ∀ d, 1 ≤ exp d := fun d => Nat.succ_le_succ (Nat.zero_le _)
  have hexp_lt : ∀ d, exp d < p := by
    intro d
    have hlt : (d - 1) % (p - 1) < p - 1 := Nat.mod_lt (d - 1) hp1_pos
    dsimp only [exp]
    omega
  have hexp_mod : ∀ d ∈ n.divisors, exp d % r = d % r := by
    intro d hd
    have hd_pos : 0 < d := Nat.pos_of_mem_divisors hd
    dsimp only [exp]
    obtain ⟨k, hk⟩ := hrp
    have hdiv : (d - 1) = (p - 1) * ((d - 1) / (p - 1)) + (d - 1) % (p - 1) :=
      (Nat.div_add_mod (d - 1) (p - 1)).symm
    have hmod_sub : (d - 1) % r = ((d - 1) % (p - 1)) % r := by
      have h1 : d - 1 = (d - 1) % (p - 1) + r * (k * ((d - 1) / (p - 1))) := by
        calc
          d - 1 = (p - 1) * ((d - 1) / (p - 1)) + (d - 1) % (p - 1) := hdiv
          _ = (d - 1) % (p - 1) + (r * k) * ((d - 1) / (p - 1)) := by rw [hk, add_comm]
          _ = (d - 1) % (p - 1) + r * (k * ((d - 1) / (p - 1))) := by ring
      conv_lhs => rw [h1, Nat.add_mul_mod_self_left]
    have hadd1 : d = (d - 1) + 1 := (Nat.sub_add_cancel hd_pos).symm
    calc
      ((d - 1) % (p - 1) + 1) % r = (((d - 1) % (p - 1)) % r + 1 % r) % r := Nat.add_mod _ 1 r
      _ = ((d - 1) % r + 1 % r) % r := by rw [← hmod_sub]
      _ = ((d - 1) + 1) % r := (Nat.add_mod (d - 1) 1 r).symm
      _ = d % r := by rw [← hadd1]
  have hpow_eq : ∀ (y : ZMod p) (d : ℕ), d ∈ n.divisors → y ^ exp d = y ^ d := by
    intro y d hd
    have hd_pos : 0 < d := Nat.pos_of_mem_divisors hd
    by_cases hy : y = 0
    · subst hy
      have h1 : exp d ≠ 0 := Nat.ne_of_gt (hexp_pos d)
      have h2 : d ≠ 0 := Nat.ne_of_gt hd_pos
      simp [zero_pow h1, zero_pow h2]
    · have hflt : y ^ (p - 1) = 1 := ZMod.pow_card_sub_one_eq_one hy
      have hd_eq : d = (p - 1) * ((d - 1) / (p - 1)) + exp d := by
        have := (Nat.div_add_mod (d - 1) (p - 1)).symm
        dsimp only [exp]
        omega
      conv_rhs => rw [hd_eq, pow_add, pow_mul, hflt, one_pow, one_mul]
  let Q : Polynomial (ZMod p) :=
    (∑ d ∈ n.divisors, Polynomial.X ^ exp d) -
      Polynomial.C (n.divisors.card : ZMod p) * Polynomial.X
  have hQ_eval : ∀ y : ZMod p, Q.eval y = 0 := by
    intro y
    have hha := ha (y.val : ℤ)
    have hp_dvd_int : (p : ℤ) ∣ (∑ d ∈ n.divisors, (y.val : ℤ) ^ d) -
        (n.divisors.card : ℤ) * (y.val : ℤ) := dvd_trans (Int.natCast_dvd_natCast.mpr hpn) hha
    have hzmod : ((∑ d ∈ n.divisors, (y.val : ℤ) ^ d -
        (n.divisors.card : ℤ) * (y.val : ℤ) : ℤ) : ZMod p) = 0 :=
      (ZMod.intCast_zmod_eq_zero_iff_dvd _ p).mpr hp_dvd_int
    push_cast at hzmod
    rw [ZMod.natCast_zmod_val] at hzmod
    have hsum : (∑ d ∈ n.divisors, y ^ exp d) = ∑ d ∈ n.divisors, y ^ d :=
      Finset.sum_congr rfl fun d hd => hpow_eq y d hd
    dsimp only [Q]
    simp only [Polynomial.eval_sub, Polynomial.eval_finsetSum, Polynomial.eval_pow,
      Polynomial.eval_X, Polynomial.eval_mul, Polynomial.eval_C]
    rw [hsum]
    exact hzmod
  have hQ_deg : Q.natDegree < p := by
    have hdeg_sum : (∑ d ∈ n.divisors, (Polynomial.X : Polynomial (ZMod p)) ^ exp d).natDegree ≤
        p - 1 := by
      refine (Polynomial.natDegree_sum_le _ _).trans ?_
      refine Finset.sup_le fun d _ => ?_
      simp only [Function.comp_apply, Polynomial.natDegree_X_pow]
      exact Nat.le_pred_of_lt (hexp_lt d)
    have hdeg_term :
        (Polynomial.C (n.divisors.card : ZMod p) * (Polynomial.X : Polynomial (ZMod p))).natDegree ≤
          p - 1 := by
      refine (Polynomial.natDegree_C_mul_le _ _).trans ?_
      rw [Polynomial.natDegree_X]
      omega
    have hle : Q.natDegree ≤ p - 1 :=
      (Polynomial.natDegree_sub_le _ _).trans (max_le hdeg_sum hdeg_term)
    omega
  have hQ_zero : Q = 0 := by
    by_contra hne
    have hroots : (Finset.univ : Finset (ZMod p)).val ⊆ Q.roots := by
      intro y _
      rw [Polynomial.mem_roots hne, Polynomial.IsRoot.def]
      exact hQ_eval y
    have hle := Polynomial.card_le_degree_of_subset_roots hroots
    rw [Finset.card_univ, ZMod.card] at hle
    omega
  let K : Finset ℕ := (Finset.range p).filter (fun k => P (k % r))
  have hcoeff_sum : (∑ k ∈ K, Q.coeff k) = 0 := by
    rw [hQ_zero]
    simp
  have hk_ne_one : ∀ k ∈ K, k ≠ 1 := by
    intro k hk hk1
    subst hk1
    have hmem := (Finset.mem_filter.mp hk).2
    have h1 : 1 % r = 1 := Nat.mod_eq_of_lt (by omega)
    rw [h1] at hmem
    exact hP1 hmem
  have hcoeff_eq : ∀ k ∈ K, Q.coeff k = ∑ d ∈ n.divisors, if exp d = k then (1 : ZMod p) else 0 := by
    intro k hk
    have hk1 : k ≠ 1 := hk_ne_one k hk
    dsimp only [Q]
    rw [Polynomial.coeff_sub, Polynomial.finsetSum_coeff, Polynomial.coeff_C_mul_X]
    simp only [hk1, ↓reduceIte, sub_zero]
    refine Finset.sum_congr rfl fun d _ => ?_
    rw [Polynomial.coeff_X_pow]
    simp [eq_comm]
  have hsum_comm : (∑ k ∈ K, Q.coeff k) =
      ((n.divisors.filter (fun d => P (d % r))).card : ZMod p) := by
    calc
      (∑ k ∈ K, Q.coeff k)
          = ∑ k ∈ K, ∑ d ∈ n.divisors, if exp d = k then (1 : ZMod p) else 0 :=
        Finset.sum_congr rfl hcoeff_eq
      _ = ∑ d ∈ n.divisors, ∑ k ∈ K, if exp d = k then (1 : ZMod p) else 0 := Finset.sum_comm
      _ = ∑ d ∈ n.divisors, if exp d ∈ K then (1 : ZMod p) else 0 := by
        refine Finset.sum_congr rfl fun d _ => ?_
        simp [Finset.sum_ite_eq]
      _ = ∑ d ∈ n.divisors, if P (d % r) then (1 : ZMod p) else 0 := by
        refine Finset.sum_congr rfl fun d hd => ?_
        have hiff : exp d ∈ K ↔ P (d % r) := by
          simp only [K, Finset.mem_filter, Finset.mem_range]
          rw [hexp_mod d hd]
          exact ⟨fun h => h.2, fun h => ⟨hexp_lt d, h⟩⟩
        simp [hiff]
      _ = ((n.divisors.filter (fun d => P (d % r))).card : ZMod p) := by
        rw [Finset.card_filter, Nat.cast_sum]
        simp
  rw [hcoeff_sum] at hsum_comm
  exact (ZMod.natCast_eq_zero_iff _ p).mp hsum_comm.symm

private lemma card_divisors_filter_eq_pow {n r : ℕ} (hn : 0 < n) (hs : Squarefree n)
    (P : ℕ → Prop) [DecidablePred P] (q₀ : ℕ) (hq₀ : q₀ ∈ n.primeFactors)
    (hflip : ∀ T ∈ (n.primeFactors.erase q₀).powerset,
      P ((∏ q ∈ insert q₀ T, q) % r) ↔ ¬ P ((∏ q ∈ T, q) % r)) :
    (n.divisors.filter (fun d => P (d % r))).card = 2 ^ (n.primeFactors.card - 1) := by
  let S := n.primeFactors
  let f : Finset ℕ → ℕ := fun T => ∏ q ∈ T, q
  have hbij : (n.divisors.filter (fun d => P (d % r))).card =
      (S.powerset.filter (fun T => P (f T % r))).card := by
    symm
    refine Finset.card_bij (fun T _ => f T) ?_ ?_ ?_
    · intro T hT
      have hT_sub : T ⊆ S := Finset.mem_powerset.mp (Finset.mem_filter.mp hT).1
      have hT_P : P (f T % r) := (Finset.mem_filter.mp hT).2
      have hdvd : f T ∣ n := by
        calc
          f T ∣ ∏ q ∈ S, q := Finset.prod_dvd_prod_of_subset _ _ _ hT_sub
          _ = n := Nat.prod_primeFactors_of_squarefree hs
      exact Finset.mem_filter.mpr ⟨Nat.mem_divisors.mpr ⟨hdvd, hn.ne'⟩, hT_P⟩
    · intro T₁ hT₁ T₂ hT₂ heq
      have h1 : ∀ q ∈ T₁, q.Prime := fun q hq =>
        Nat.prime_of_mem_primeFactors (Finset.mem_powerset.mp (Finset.mem_filter.mp hT₁).1 hq)
      have h2 : ∀ q ∈ T₂, q.Prime := fun q hq =>
        Nat.prime_of_mem_primeFactors (Finset.mem_powerset.mp (Finset.mem_filter.mp hT₂).1 hq)
      have hp1 := Nat.primeFactors_prod h1
      have hp2 := Nat.primeFactors_prod h2
      dsimp only [f] at heq
      rw [← hp1, ← hp2, heq]
    · intro d hd
      have hd_mem := (Finset.mem_filter.mp hd).1
      have hd_P := (Finset.mem_filter.mp hd).2
      have hd_dvd : d ∣ n := (Nat.mem_divisors.mp hd_mem).1
      have hds : Squarefree d := hs.squarefree_of_dvd hd_dvd
      have hsub : d.primeFactors ⊆ S := Nat.primeFactors_mono hd_dvd hn.ne'
      have hprod : f d.primeFactors = d := Nat.prod_primeFactors_of_squarefree hds
      refine ⟨d.primeFactors, Finset.mem_filter.mpr ⟨Finset.mem_powerset.mpr hsub, ?_⟩, hprod⟩
      rwa [hprod]
  rw [hbij]
  let S' := S.erase q₀
  have hS : S = insert q₀ S' := (Finset.insert_erase hq₀).symm
  have hpow_union : S.powerset = S'.powerset ∪ S'.powerset.image (insert q₀) := by
    nth_rw 1 [hS]
    exact Finset.powerset_insert S' q₀
  have hdisj : Disjoint S'.powerset (S'.powerset.image (insert q₀)) := by
    rw [Finset.disjoint_left]
    intro T hT1 hT2
    rcases Finset.mem_image.mp hT2 with ⟨T', _, rfl⟩
    have hnot : q₀ ∉ insert q₀ T' := fun h => Finset.notMem_erase q₀ S (Finset.mem_powerset.mp hT1 h)
    exact hnot (Finset.mem_insert_self q₀ T')
  have hinj : Set.InjOn (insert q₀) (S'.powerset : Set (Finset ℕ)) := by
    intro T₁ hT₁ T₂ hT₂ heq
    have hn1 : q₀ ∉ T₁ := fun h => Finset.notMem_erase q₀ S (Finset.mem_powerset.mp hT₁ h)
    have hn2 : q₀ ∉ T₂ := fun h => Finset.notMem_erase q₀ S (Finset.mem_powerset.mp hT₂ h)
    have := congrArg (fun s => Finset.erase s q₀) heq
    simpa [Finset.erase_insert hn1, Finset.erase_insert hn2] using this
  have hcard_filter : (S.powerset.filter (fun T => P (f T % r))).card =
      ∑ T ∈ S.powerset, if P (f T % r) then 1 else 0 := by
    rw [Finset.card_filter]
  rw [hcard_filter, hpow_union, Finset.sum_union hdisj, Finset.sum_image hinj,
    ← Finset.sum_add_distrib]
  have hpair : ∑ T ∈ S'.powerset, ((if P (f T % r) then 1 else 0) +
      if P (f (insert q₀ T) % r) then 1 else 0) = ∑ _T ∈ S'.powerset, 1 := by
    refine Finset.sum_congr rfl fun T hT => ?_
    have hiff := hflip T hT
    by_cases hP : P (f T % r)
    · have hP' : ¬ P (f (insert q₀ T) % r) := fun h => hiff.mp h hP
      simp [hP, hP']
    · have hP' : P (f (insert q₀ T) % r) := hiff.mpr hP
      simp [hP, hP']
  rw [hpair, Finset.sum_const, smul_eq_mul, mul_one, Finset.card_powerset,
    Finset.card_erase_of_mem hq₀]

theorem problem5 (n p r m : ℕ) (hn : 0 < n) (hs : Squarefree n)
    (hr : r.Prime) (hf : r = 2 ^ (2 ^ m) + 1)
    (hp : p.Prime) (hpn : p ∣ n) (hpr : Nat.ModEq r p 1)
    (ha : ∀ x : ℤ, (n : ℤ) ∣ (∑ d ∈ n.divisors, x ^ d) - (n.divisors.card : ℤ) * x) :
    ∀ d ∈ n.divisors, Nat.ModEq r d 1 := by
  have : Fact r.Prime := ⟨hr⟩
  have hr3 : 3 ≤ r := by
    have h1 : 1 ≤ 2 ^ m := Nat.one_le_two_pow
    have h2 : 2 ^ 1 ≤ 2 ^ (2 ^ m) := Nat.pow_le_pow_right (by omega) h1
    omega
  have hrp : r ∣ p - 1 := by
    have h1 : p % r = 1 % r := hpr
    have h1' : 1 % r = 1 := Nat.mod_eq_of_lt (by omega)
    rw [h1'] at h1
    have hdiv : r * (p / r) + p % r = p := Nat.div_add_mod p r
    rw [h1] at hdiv
    exact ⟨p / r, by omega⟩
  have hp_ne_two : p ≠ 2 := by
    intro hp2
    rw [hp2] at hrp
    exact absurd (Nat.le_of_dvd (by omega) hrp) (by omega)
  have hp_ndvd_two_pow : ∀ k : ℕ, ¬ p ∣ 2 ^ k := by
    intro k hdvd
    rcases Nat.Prime.eq_one_or_self_of_dvd Nat.prime_two p (hp.dvd_of_dvd_pow hdvd) with h | h
    · exact hp.ne_one h
    · exact hp_ne_two h
  have hr_not_mem : r ∉ n.primeFactors := by
    intro hrn
    let P : ℕ → Prop := fun c => c = 0
    have hP1 : ¬ P 1 := by decide
    have hdvd := dvd_card_divisors_filter hp hr3 hrp hpn ha P hP1
    have hcard : (n.divisors.filter (fun d => P (d % r))).card = 2 ^ (n.primeFactors.card - 1) := by
      refine card_divisors_filter_eq_pow hn hs P r hrn fun T hT => ?_
      have hr_not_T : r ∉ T := fun h => Finset.notMem_erase r n.primeFactors (Finset.mem_powerset.mp hT h)
      have hprod_ins : ∏ q ∈ insert r T, q = r * ∏ q ∈ T, q := Finset.prod_insert hr_not_T
      have h_lhs : P ((∏ q ∈ insert r T, q) % r) := by
        dsimp only [P]
        rw [hprod_ins, Nat.mul_mod_right]
      have h_ndvd : ¬ r ∣ ∏ q ∈ T, q := by
        intro hdiv
        have hex := (hr.prime.dvd_finsetProd_iff id).mp hdiv
        rcases hex with ⟨q, hqT, hqr⟩
        have hq_mem := Finset.mem_erase.mp (Finset.mem_powerset.mp hT hqT)
        have hqp : q.Prime := Nat.prime_of_mem_primeFactors hq_mem.2
        rcases hqp.eq_one_or_self_of_dvd r hqr with h1 | h2
        · exact hr.ne_one h1
        · exact hq_mem.1 h2.symm
      have h_rhs : ¬ P ((∏ q ∈ T, q) % r) := by
        dsimp only [P]
        exact fun h => h_ndvd (Nat.dvd_of_mod_eq_zero h)
      simp [h_lhs, h_rhs]
    rw [hcard] at hdvd
    exact hp_ndvd_two_pow (n.primeFactors.card - 1) hdvd
  have hprime_mod : ∀ q ∈ n.primeFactors, Nat.ModEq r q 1 := by
    classical
    by_contra hnot
    push Not at hnot
    rcases hnot with ⟨q₁, hq₁, hq₁_ne⟩
    have hq_flt : ∀ q ∈ n.primeFactors, ∃ t : ℕ, (q : ZMod r) ^ (2 ^ t) = 1 := by
      intro q hq
      have hq_ne_zero : (q : ZMod r) ≠ 0 := by
        intro hqz
        have hr_dvd_q : r ∣ q := (ZMod.natCast_eq_zero_iff q r).mp hqz
        have hqp : q.Prime := Nat.prime_of_mem_primeFactors hq
        rcases hqp.eq_one_or_self_of_dvd r hr_dvd_q with h1 | hqr
        · exact hr.ne_one h1
        · exact hr_not_mem (hqr ▸ hq)
      refine ⟨2 ^ m, ?_⟩
      have hr1 : r - 1 = 2 ^ (2 ^ m) := by omega
      rw [← hr1]
      exact ZMod.pow_card_sub_one_eq_one hq_ne_zero
    let k : ℕ → ℕ := fun q => if h : ∃ t : ℕ, (q : ZMod r) ^ (2 ^ t) = 1 then Nat.find h else 0
    have hk_spec : ∀ q ∈ n.primeFactors, (q : ZMod r) ^ (2 ^ k q) = 1 := by
      intro q hq
      have hqex := hq_flt q hq
      dsimp only [k]
      split_ifs
      exact Nat.find_spec hqex
    have hk_min : ∀ q ∈ n.primeFactors, ∀ t < k q, (q : ZMod r) ^ (2 ^ t) ≠ 1 := by
      intro q hq t ht
      dsimp only [k] at ht
      split_ifs at ht with hqex
      · exact Nat.find_min hqex ht
      · omega
    have hq₁_k_pos : 1 ≤ k q₁ := by
      by_contra h0
      have hk0 : k q₁ = 0 := by omega
      have hspec := hk_spec q₁ hq₁
      rw [hk0, pow_zero, pow_one] at hspec
      exact hq₁_ne ((ZMod.natCast_eq_natCast_iff q₁ 1 r).mp (by simpa using hspec))
    let k₀ : ℕ := n.primeFactors.sup k
    have hk₀_pos : 1 ≤ k₀ := le_trans hq₁_k_pos (Finset.le_sup hq₁)
    obtain ⟨q₀, hq₀, hk₀_eq⟩ := Finset.exists_mem_eq_sup n.primeFactors ⟨q₁, hq₁⟩ k
    change k₀ = k q₀ at hk₀_eq
    have hq_pow_k₀ : ∀ q ∈ n.primeFactors, (q : ZMod r) ^ (2 ^ k₀) = 1 := by
      intro q hq
      have hle : k q ≤ k₀ := Finset.le_sup hq
      have hadd : k q + (k₀ - k q) = k₀ := Nat.add_sub_of_le hle
      rw [← hadd, pow_add, pow_mul, hk_spec q hq, one_pow]
    let E : ℕ := 2 ^ (k₀ - 1)
    have hE2 : E * 2 = 2 ^ k₀ := by
      dsimp only [E]
      have hk1 : (k₀ - 1) + 1 = k₀ := Nat.sub_add_cancel hk₀_pos
      rw [← pow_succ, hk1]
    have h1_ne_neg1 : (1 : ZMod r) ≠ -1 := by
      intro h1
      have h2zero : ((2 : ℕ) : ZMod r) = 0 := by
        calc
          ((2 : ℕ) : ZMod r) = (1 : ZMod r) + 1 := by norm_num
          _ = 1 - (-1 : ZMod r) := by ring
          _ = 0 := by rw [← h1, sub_self]
      have hdvd : r ∣ 2 := (ZMod.natCast_eq_zero_iff 2 r).mp h2zero
      exact absurd (Nat.le_of_dvd (by omega) hdvd) (by omega)
    have hq₀_E : (q₀ : ZMod r) ^ E = -1 := by
      have hsq : ((q₀ : ZMod r) ^ E) ^ 2 = 1 := by
        rw [← pow_mul, hE2]
        exact hq_pow_k₀ q₀ hq₀
      have hne1 : (q₀ : ZMod r) ^ E ≠ 1 := by
        refine hk_min q₀ hq₀ (k₀ - 1) ?_
        rw [← hk₀_eq]
        omega
      rcases sq_eq_one_iff.mp hsq with hpos | hneg
      · exact absurd hpos hne1
      · exact hneg
    let P : ℕ → Prop := fun c => (c : ZMod r) ^ E = -1
    have hP1 : ¬ P 1 := by
      dsimp only [P]
      simp [h1_ne_neg1]
    have hdvd := dvd_card_divisors_filter hp hr3 hrp hpn ha P hP1
    have hcard : (n.divisors.filter (fun d => P (d % r))).card = 2 ^ (n.primeFactors.card - 1) := by
      refine card_divisors_filter_eq_pow hn hs P q₀ hq₀ fun T hT => ?_
      have hq₀_not_T : q₀ ∉ T := fun h => Finset.notMem_erase q₀ n.primeFactors (Finset.mem_powerset.mp hT h)
      have hprod_ins : ∏ q ∈ insert q₀ T, q = q₀ * ∏ q ∈ T, q := Finset.prod_insert hq₀_not_T
      let x := ∏ q ∈ T, q
      have hx_sq : ((x : ZMod r) ^ E) ^ 2 = 1 := by
        have hx_cast : (x : ZMod r) = ∏ q ∈ T, (q : ZMod r) := by
          dsimp only [x]
          rw [Nat.cast_prod]
        rw [hx_cast, ← Finset.prod_pow, ← Finset.prod_pow]
        refine Finset.prod_eq_one fun q hq => ?_
        have hq_mem : q ∈ n.primeFactors := Finset.erase_subset q₀ _ (Finset.mem_powerset.mp hT hq)
        rw [← pow_mul, hE2]
        exact hq_pow_k₀ q hq_mem
      have hins_eval : (((∏ q ∈ insert q₀ T, q) % r : ℕ) : ZMod r) ^ E =
          (-1 : ZMod r) * ((x : ZMod r) ^ E) := by
        rw [ZMod.natCast_mod, hprod_ins, Nat.cast_mul, mul_pow, hq₀_E]
      have hx_eval : (((x % r : ℕ) : ZMod r) ^ E) = (x : ZMod r) ^ E := by
        rw [ZMod.natCast_mod]
      dsimp only [P]
      rw [hins_eval]
      change (-1 : ZMod r) * (x : ZMod r) ^ E = -1 ↔ ¬ (((x % r : ℕ) : ZMod r) ^ E = -1)
      rw [hx_eval]
      rcases sq_eq_one_iff.mp hx_sq with hpos | hneg
      · simp [hpos, h1_ne_neg1]
      · simp [hneg, h1_ne_neg1]
    rw [hcard] at hdvd
    exact hp_ndvd_two_pow (n.primeFactors.card - 1) hdvd
  intro d hd
  have hd_dvd : d ∣ n := (Nat.mem_divisors.mp hd).1
  have hds : Squarefree d := hs.squarefree_of_dvd hd_dvd
  have hsub : d.primeFactors ⊆ n.primeFactors := Nat.primeFactors_mono hd_dvd hn.ne'
  have hprod : ∏ q ∈ d.primeFactors, q = d := Nat.prod_primeFactors_of_squarefree hds
  have hd_zmod : (d : ZMod r) = ((1 : ℕ) : ZMod r) := by
    calc
      (d : ZMod r) = ((∏ q ∈ d.primeFactors, q : ℕ) : ZMod r) := by rw [hprod]
      _ = ∏ q ∈ d.primeFactors, (q : ZMod r) := Nat.cast_prod _ _
      _ = ∏ _q ∈ d.primeFactors, (1 : ZMod r) := by
        refine Finset.prod_congr rfl fun q hq => ?_
        have hm := hprime_mod q (hsub hq)
        simpa using (ZMod.natCast_eq_natCast_iff q 1 r).mpr hm
      _ = ((1 : ℕ) : ZMod r) := by simp
  exact (ZMod.natCast_eq_natCast_iff d 1 r).mp hd_zmod
