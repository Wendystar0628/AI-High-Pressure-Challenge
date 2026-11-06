import Mathlib.FieldTheory.Finite.Basic
import Mathlib.RingTheory.RootsOfUnity.PrimitiveRoots
import Mathlib.Data.Nat.Squarefree
import Mathlib.Algebra.MonoidAlgebra.Basic
import Mathlib.Tactic.Linarith
import Mathlib.Tactic.NormNum
import Mathlib.Tactic.Ring

open Polynomial Finset

private lemma divisor_residue_polynomial (n p r : ℕ)
    (hp : p.Prime) (hr : r.Prime) (hpn : p ∣ n) (hpr : Nat.ModEq r p 1)
    (ha : ∀ x : ℤ, (n : ℤ) ∣ (∑ d ∈ n.divisors, x ^ d) - (n.divisors.card : ℤ) * x) :
    (∑ d ∈ n.divisors, (X : (ZMod p)[X]) ^ (d % r)) = C (n.divisors.card : ZMod p) * X := by
  letI : Fact p.Prime := ⟨hp⟩
  letI : Fact r.Prime := ⟨hr⟩
  have hfield (x : ZMod p) : (∑ d ∈ n.divisors, x ^ d) = (n.divisors.card : ZMod p) * x := by
    have hdiv : (p : ℤ) ∣ (∑ d ∈ n.divisors, (x.val : ℤ) ^ d) -
        (n.divisors.card : ℤ) * (x.val : ℤ) := (Int.natCast_dvd_natCast.mpr hpn).trans (ha x.val)
    have he := (ZMod.intCast_zmod_eq_zero_iff_dvd _ p).mpr hdiv
    simpa only [Int.cast_sub, Int.cast_sum, Int.cast_pow, Int.cast_natCast,
      ZMod.natCast_zmod_val, Int.cast_mul, sub_eq_zero] using he
  have hrp : r ∣ Fintype.card (ZMod p)ˣ := by
    rw [ZMod.card_units]
    exact hpr.symm.dvd'
  obtain ⟨z, hz⟩ := exists_prime_orderOf_dvd_card r hrp
  have hroot : IsPrimitiveRoot (z : ZMod p) r := by
    rw [← hz, ← orderOf_units]
    exact IsPrimitiveRoot.orderOf (z : ZMod p)
  apply eq_of_natDegree_lt_card_of_eval_eq
    (f := fun i : Fin r => (z : ZMod p) ^ (i : ℕ))
  · intro i j hij
    exact Fin.ext (hroot.pow_inj i.isLt j.isLt hij)
  · intro i
    have hpow : ((z : ZMod p) ^ (i : ℕ)) ^ r = 1 := by
      rw [← pow_mul, Nat.mul_comm, pow_mul, hroot.pow_eq_one, one_pow]
    simp only [eval_finsetSum, eval_pow, eval_X, eval_mul, eval_C]
    convert hfield ((z : ZMod p) ^ (i : ℕ)) using 1
    apply congrArg (fun t : ZMod p => t)
    apply Finset.sum_congr rfl
    intro d hd
    exact pow_eq_pow_of_modEq (Nat.mod_modEq d r) hpow
  · rw [Fintype.card_fin, max_lt_iff]
    constructor
    · apply lt_of_le_of_lt (natDegree_sum_le_of_forall_le n.divisors _
        (n := r - 1) (fun d hd => ?_)) (Nat.sub_lt hr.pos (by norm_num))
      simpa only [natDegree_X_pow, Nat.pred_eq_sub_one] using
        Nat.le_pred_of_lt (Nat.mod_lt d hr.pos)
    · exact (natDegree_C_mul_le _ _).trans_lt (by simpa using hr.one_lt)

private lemma squarefree_sum_prod {R : Type*} [CommSemiring R]
    (n : ℕ) (hs : Squarefree n) (f : ℕ →* R) :
    (∑ d ∈ n.divisors, f d) = ∏ q ∈ n.primeFactors, (1 + f q) := by
  rw [← Nat.divisors_filter_squarefree_of_squarefree hs,
    Nat.sum_divisors_filter_squarefree hs.ne_zero, Nat.factors_eq,
    Finset.prod_one_add]
  apply Finset.sum_congr
  · change n.primeFactorsList.toFinset.powerset = n.primeFactors.powerset
    rw [Nat.toFinset_factors]
  · intro s hs
    simpa only [Finset.prod_eq_multiset_prod, Multiset.map_id'] using
      map_prod f (fun x : ℕ => x) s

private lemma squarefree_card_divisors (n : ℕ) (hs : Squarefree n) :
    n.divisors.card = 2 ^ n.primeFactors.card := by
  simpa using squarefree_sum_prod n hs (1 : ℕ →* ℕ)

private lemma divisor_residue_algebra (n p r : ℕ)
    (hp : p.Prime) (hr : r.Prime) (hpn : p ∣ n) (hpr : Nat.ModEq r p 1)
    (ha : ∀ x : ℤ, (n : ℤ) ∣ (∑ d ∈ n.divisors, x ^ d) - (n.divisors.card : ℤ) * x) :
    (∑ d ∈ n.divisors, MonoidAlgebra.single (d : ZMod r) (1 : ZMod p)) =
      (n.divisors.card : MonoidAlgebra (ZMod p) (ZMod r)) := by
  letI : Fact p.Prime := ⟨hp⟩
  letI : Fact r.Prime := ⟨hr⟩
  apply MonoidAlgebra.ext
  apply Finsupp.ext
  intro k
  have he := congrArg (fun f : (ZMod p)[X] => f.coeff k.val)
    (divisor_residue_polynomial n p r hp hr hpn hpr ha)
  have heq (d : ℕ) : (d : ZMod r) = k ↔ d % r = k.val := by
    rw [← (ZMod.val_injective r).eq_iff, ZMod.val_natCast]
  have h1 : (1 : ZMod r) = k ↔ 1 = k.val := by
    rw [← (ZMod.val_injective r).eq_iff, ZMod.val_one]
  simp only [MonoidAlgebra.coeff_sum, Finsupp.finset_sum_apply,
    MonoidAlgebra.coeff_single, Finsupp.single_apply,
    MonoidAlgebra.coeff_natCast, heq, h1]
  simpa [coeff_sum, coeff_X_pow, coeff_C_mul, coeff_X, eq_comm, mul_ite] using he

private lemma squarefree_residue_product (n p r : ℕ) (hs : Squarefree n)
    (hp : p.Prime) (hr : r.Prime) (hpn : p ∣ n) (hpr : Nat.ModEq r p 1)
    (ha : ∀ x : ℤ, (n : ℤ) ∣ (∑ d ∈ n.divisors, x ^ d) - (n.divisors.card : ℤ) * x) :
    (∏ q ∈ n.primeFactors,
      (1 + MonoidAlgebra.single (q : ZMod r) (1 : ZMod p))) =
      (2 : MonoidAlgebra (ZMod p) (ZMod r)) ^ n.primeFactors.card := by
  let e : ℕ →* MonoidAlgebra (ZMod p) (ZMod r) :=
    { toFun := fun d => MonoidAlgebra.single (d : ZMod r) 1
      map_one' := by simp [MonoidAlgebra.one_def]
      map_mul' := by intros; simp }
  have he := squarefree_sum_prod n hs e
  change (∑ d ∈ n.divisors, MonoidAlgebra.single (d : ZMod r) (1 : ZMod p)) =
    (∏ q ∈ n.primeFactors, (1 + MonoidAlgebra.single (q : ZMod r) (1 : ZMod p))) at he
  rw [← he, divisor_residue_algebra n p r hp hr hpn hpr ha,
    squarefree_card_divisors n hs, Nat.cast_pow, Nat.cast_ofNat]

private lemma even_order_not_unit {K M : Type*} [CommRing K] [Nontrivial K] [CommMonoid M]
    (z : M) (hpos : 0 < orderOf z) (heven : Even (orderOf z)) :
    ¬ IsUnit (1 + MonoidAlgebra.single z (1 : K)) := by
  classical
  let v : MonoidAlgebra K M := MonoidAlgebra.single z 1
  let s := ∑ i ∈ Finset.range (orderOf z), (-v) ^ i
  have hp : (-v) ^ orderOf z = 1 := by
    rw [heven.neg_pow, show v = MonoidAlgebra.single z (1 : K) from rfl,
      MonoidAlgebra.single_pow, pow_orderOf_eq_one, one_pow, ← MonoidAlgebra.one_def]
  have hm : s * (1 + v) = 0 := by
    have hh := geom_sum_mul_neg (-v) (orderOf z)
    simpa [s, hp] using hh
  have hc : s.coeff 1 = 1 := by
    change (∑ i ∈ Finset.range (orderOf z), (-MonoidAlgebra.single z (1 : K)) ^ i).coeff 1 = 1
    simp only [← MonoidAlgebra.single_neg, MonoidAlgebra.single_pow,
      MonoidAlgebra.coeff_sum, Finsupp.finsetSum_apply, MonoidAlgebra.coeff_single]
    rw [Finset.sum_eq_single 0]
    · simp
    · intro i hi hi0
      have hzi : z ^ i ≠ 1 := pow_ne_one_of_lt_orderOf hi0 (Finset.mem_range.mp hi)
      simp [Finsupp.single_apply, hzi]
    · intro h
      exact False.elim (h (Finset.mem_range.mpr hpos))
  intro hu
  have hs : s = 0 := hu.mul_right_cancel (by simpa using hm)
  rw [hs] at hc
  simpa using hc

private lemma zero_coeff_mul {K M : Type*} [CommSemiring K] [CommMonoidWithZero M]
    [NoZeroDivisors M] (F G : MonoidAlgebra K M)
    (hF : F.coeff 0 = 0) (hG : G.coeff 0 = 0) : (F * G).coeff 0 = 0 := by
  classical
  rw [MonoidAlgebra.coeff_mul]
  apply Finset.sum_eq_zero
  intro a ha
  apply Finset.sum_eq_zero
  intro b hb
  have ha0 : a ≠ 0 := by
    intro he
    subst a
    exact (Finsupp.mem_support_iff.mp ha) hF
  have hb0 : b ≠ 0 := by
    intro he
    subst b
    exact (Finsupp.mem_support_iff.mp hb) hG
  simp [mul_ne_zero ha0 hb0]

private lemma zero_coeff_product {K M ι : Type*} [CommSemiring K] [CommMonoidWithZero M]
    [NoZeroDivisors M] [Nontrivial M] (s : Finset ι) (f : ι → M)
    (hf : ∀ i ∈ s, f i ≠ 0) :
    (∏ i ∈ s, (1 + MonoidAlgebra.single (f i) (1 : K))).coeff 0 = 0 := by
  classical
  induction s using Finset.induction_on with
  | empty => simp [MonoidAlgebra.one_def]
  | @insert a s ha ih =>
    rw [Finset.prod_insert ha]
    apply zero_coeff_mul
    · simp [MonoidAlgebra.one_def, MonoidAlgebra.coeff_add, Finsupp.single_apply,
        hf a (Finset.mem_insert_self _ _)]
    · exact ih (fun i hi => hf i (Finset.mem_insert_of_mem hi))

private lemma zero_basis_product {K M ι : Type*} [CommSemiring K] [CommMonoidWithZero M]
    (s : Finset ι) (f : ι → M) :
    MonoidAlgebra.single (0 : M) (1 : K) *
      (∏ i ∈ s, (1 + MonoidAlgebra.single (f i) (1 : K))) =
      MonoidAlgebra.single 0 ((2 : K) ^ s.card) := by
  classical
  induction s using Finset.induction_on with
  | empty => simp
  | @insert a s ha ih =>
    rw [Finset.prod_insert ha, Finset.card_insert_of_notMem ha]
    rw [mul_left_comm, ih, add_mul, one_mul, MonoidAlgebra.single_mul_single,
      mul_zero, one_mul, ← MonoidAlgebra.single_add]
    congr 1
    ring

private lemma residue_primes_ne_zero (n p r : ℕ) (hs : Squarefree n)
    (hp : p.Prime) (hr : r.Prime) (hpn : p ∣ n) (hpr : Nat.ModEq r p 1)
    (ha : ∀ x : ℤ, (n : ℤ) ∣ (∑ d ∈ n.divisors, x ^ d) - (n.divisors.card : ℤ) * x) :
    ∀ q ∈ n.primeFactors, (q : ZMod r) ≠ 0 := by
  classical
  letI : Fact p.Prime := ⟨hp⟩
  letI : Fact r.Prime := ⟨hr⟩
  have hp2 : 2 < p := by
    have := Nat.le_of_dvd (Nat.sub_pos_of_lt hp.one_lt) hpr.symm.dvd'
    have := hr.two_le
    omega
  have htwo : (2 : ZMod p) ≠ 0 := by
    intro he
    exact Nat.not_dvd_of_pos_of_lt (by norm_num) hp2 ((ZMod.natCast_eq_zero_iff 2 p).mp he)
  have hprod := squarefree_residue_product n p r hs hp hr hpn hpr ha
  intro q hq hzero
  have hqr : q = r :=
    (Nat.prime_dvd_prime_iff_eq hr (Nat.prime_of_mem_primeFactors hq)).mp
      ((ZMod.natCast_eq_zero_iff q r).mp hzero) |>.symm
  subst q
  let s := n.primeFactors.erase r
  let T : MonoidAlgebra (ZMod p) (ZMod r) :=
    ∏ q ∈ s, (1 + MonoidAlgebra.single (q : ZMod r) (1 : ZMod p))
  have hT : T.coeff 0 = 0 := by
    apply zero_coeff_product
    intro q hq'
    have hqmem := Finset.mem_erase.mp hq'
    intro he
    have hd : r ∣ q := (ZMod.natCast_eq_zero_iff q r).mp he
    exact hqmem.1 ((Nat.prime_dvd_prime_iff_eq hr (Nat.prime_of_mem_primeFactors hqmem.2)).mp hd).symm
  have hmul : MonoidAlgebra.single (0 : ZMod r) (1 : ZMod p) * T =
      MonoidAlgebra.single 0 ((2 : ZMod p) ^ s.card) :=
    zero_basis_product s (fun q : ℕ => (q : ZMod r))
  have hex : (1 + MonoidAlgebra.single (0 : ZMod r) (1 : ZMod p)) * T =
      (2 : MonoidAlgebra (ZMod p) (ZMod r)) ^ n.primeFactors.card := by
    rw [← hprod]
    simpa only [ZMod.natCast_self] using
      (Finset.mul_prod_erase n.primeFactors
        (fun q => 1 + MonoidAlgebra.single (q : ZMod r) (1 : ZMod p)) hq)
  rw [add_mul, one_mul, hmul] at hex
  have he := congrArg (fun v : MonoidAlgebra (ZMod p) (ZMod r) => v.coeff 0) hex
  have hR : ((2 : MonoidAlgebra (ZMod p) (ZMod r)) ^ n.primeFactors.card).coeff 0 = 0 := by
    rw [show (2 : MonoidAlgebra (ZMod p) (ZMod r)) = MonoidAlgebra.single 1 (2 : ZMod p) from rfl,
      MonoidAlgebra.single_pow]
    simp
  simp only [MonoidAlgebra.coeff_add, Finsupp.add_apply, hT,
    MonoidAlgebra.coeff_single, Finsupp.single_eq_same, zero_add, hR] at he
  exact pow_ne_zero s.card htwo he

theorem problem7 (n p r m : ℕ) (hn : 0 < n) (hs : Squarefree n)
    (hr : r.Prime) (hf : r = 2 ^ (2 ^ m) + 1)
    (hp : p.Prime) (hpn : p ∣ n) (hpr : Nat.ModEq r p 1)
    (ha : ∀ x : ℤ, (n : ℤ) ∣ (∑ d ∈ n.divisors, x ^ d) - (n.divisors.card : ℤ) * x) :
    ∀ d ∈ n.divisors, Nat.ModEq r d 1 := by
  classical
  letI : Fact p.Prime := ⟨hp⟩
  letI : Fact r.Prime := ⟨hr⟩
  have hp2 : 2 < p := by
    have := Nat.le_of_dvd (Nat.sub_pos_of_lt hp.one_lt) hpr.symm.dvd'
    have := hr.two_le
    omega
  have htwo : (2 : ZMod p) ≠ 0 := by
    intro he
    exact Nat.not_dvd_of_pos_of_lt (by norm_num) hp2 ((ZMod.natCast_eq_zero_iff 2 p).mp he)
  have hunit : IsUnit (2 : MonoidAlgebra (ZMod p) (ZMod r)) := by
    change IsUnit (MonoidAlgebra.single (1 : ZMod r) (2 : ZMod p))
    exact (isUnit_iff_ne_zero.mpr htwo).map
      (algebraMap (ZMod p) (MonoidAlgebra (ZMod p) (ZMod r)))
  have hprod := squarefree_residue_product n p r hs hp hr hpn hpr ha
  have hprime : ∀ q ∈ n.primeFactors, (q : ZMod r) = 1 := by
    intro q hq
    have hq0 := residue_primes_ne_zero n p r hs hp hr hpn hpr ha q hq
    by_contra hq1
    have hd : orderOf (q : ZMod r) ∣ 2 ^ (2 ^ m) := by
      have hh := ZMod.orderOf_dvd_card_sub_one hq0
      simpa [hf] using hh
    obtain ⟨k, hk, heq⟩ := (Nat.dvd_prime_pow Nat.prime_two).mp hd
    have hk0 : k ≠ 0 := by
      intro he
      rw [he, pow_zero, orderOf_eq_one_iff] at heq
      exact hq1 heq
    have heven : Even (orderOf (q : ZMod r)) := by
      rw [heq]
      exact even_two.pow_of_ne_zero hk0
    have hpos : 0 < orderOf (q : ZMod r) := by rw [heq]; positivity
    apply even_order_not_unit (K := ZMod p) (q : ZMod r) hpos heven
    apply isUnit_of_dvd_unit (Finset.dvd_prod_of_mem
      (fun q : ℕ => 1 + MonoidAlgebra.single (q : ZMod r) (1 : ZMod p)) hq)
    rw [hprod]
    exact hunit.pow _
  intro d hd
  apply (ZMod.natCast_eq_natCast_iff d 1 r).mp
  have hdn : d ∣ n := (Nat.mem_divisors.mp hd).1
  have hds : Squarefree d := hs.squarefree_of_dvd hdn
  rw [← Nat.prod_primeFactors_of_squarefree hds, Nat.cast_prod, Nat.cast_one]
  exact Finset.prod_eq_one (fun q hq => hprime q (Nat.primeFactors_mono hdn hn.ne' hq))
