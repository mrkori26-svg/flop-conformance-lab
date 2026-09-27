#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use frame_support::pallet_prelude::*;
    use frame_system::pallet_prelude::*;

    #[pallet::config]
    pub trait Config: frame_system::Config<RuntimeEvent: From<Event<Self>>> {}

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[pallet::storage]
    pub type ReportDataByTask<T: Config> =
        StorageMap<_, Blake2_128Concat, [u8; 32], [u8; 64], OptionQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        F1Executed { who: T::AccountId, task_hash: [u8; 32], report_data: [u8; 64] },
    }

    #[pallet::error]
    pub enum Error<T> {
        DuplicateTask,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        #[pallet::call_index(0)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn submit_f1(
            origin: OriginFor<T>,
            genesis_hash: [u8; 32],
            agent_account_id32: [u8; 32],
            nonce: u64,
            model_hash: [u8; 32],
            payload_hash: [u8; 32],
            commit_hash: [u8; 32],
            gn_weight: u64,
            latency_ms: u64,
            output_hash: [u8; 32],
            decode_policy_hash: [u8; 32],
            tee_type: u8,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let mut task = Vec::with_capacity(183);
            task.extend_from_slice(b"FLOP/POUI/TASK");
            task.push(1);
            task.extend_from_slice(&genesis_hash);
            task.extend_from_slice(&agent_account_id32);
            task.extend_from_slice(&nonce.to_le_bytes());
            task.extend_from_slice(&model_hash);
            task.extend_from_slice(&payload_hash);
            task.extend_from_slice(&commit_hash);
            debug_assert_eq!(task.len(), 183);
            let task_hash = sp_io::hashing::blake2_256(&task);
            ensure!(!ReportDataByTask::<T>::contains_key(task_hash), Error::<T>::DuplicateTask);

            let mut report = Vec::with_capacity(145);
            report.extend_from_slice(&task_hash);
            report.extend_from_slice(&gn_weight.to_le_bytes());
            report.extend_from_slice(&latency_ms.to_le_bytes());
            report.extend_from_slice(&model_hash);
            report.extend_from_slice(&output_hash);
            report.extend_from_slice(&decode_policy_hash);
            report.push(tee_type);
            debug_assert_eq!(report.len(), 145);

            let digest = sp_io::hashing::sha2_256(&report);
            let mut report_data = [0u8; 64];
            report_data[..32].copy_from_slice(&digest);

            ReportDataByTask::<T>::insert(task_hash, report_data);
            Self::deposit_event(Event::F1Executed { who, task_hash, report_data });
            Ok(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use frame_support::{assert_noop, assert_ok, derive_impl, traits::PalletInfoAccess};
    use hex_literal::hex;

    type Block = frame_system::mocking::MockBlock<Test>;

    frame_support::construct_runtime!(
        pub enum Test {
            System: frame_system = 0,
            FlopPoui: pallet = 86,
        }
    );

    #[derive_impl(frame_system::config_preludes::TestDefaultConfig)]
    impl frame_system::Config for Test {
        type Block = Block;
    }

    impl Config for Test {}

    fn ext() -> sp_io::TestExternalities {
        sp_io::TestExternalities::default()
    }

    fn args() -> (
        [u8;32],[u8;32],u64,[u8;32],[u8;32],[u8;32],u64,u64,[u8;32],[u8;32],u8
    ) {
        (
            hex!("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
            [0x11;32], 7, [0x02;32], [0x05;32], [0x06;32], 42, 500,
            [0x03;32],
            hex!("be572af01bd68df9c660da094b7796244dd29435d532c63c9f42efe6bdabd796"),
            0,
        )
    }

    #[test]
    fn pallet_is_index_86_and_f1_matches_vector() {
        ext().execute_with(|| {
            assert_eq!(<Pallet<Test> as PalletInfoAccess>::index(), 86);
            let (g,a,n,m,p,c,w,l,o,d,t) = args();
            assert_ok!(FlopPoui::submit_f1(RuntimeOrigin::signed(1), g,a,n,m,p,c,w,l,o,d,t));
            let task = hex!("8d06cbf826718cda29c2ec2aa363ea13cebc118947eed5fa5d4dbb364357920d");
            let report = ReportDataByTask::<Test>::get(task).expect("stored");
            assert_eq!(report, hex!("3165c6d38fbf992485c8c8640476f9a7a5db94523a32387e838d205d178bfff70000000000000000000000000000000000000000000000000000000000000000"));
        });
    }

    #[test]
    fn replay_is_rejected() {
        ext().execute_with(|| {
            let (g,a,n,m,p,c,w,l,o,d,t) = args();
            assert_ok!(FlopPoui::submit_f1(RuntimeOrigin::signed(1), g,a,n,m,p,c,w,l,o,d,t));
            let (g,a,n,m,p,c,w,l,o,d,t) = args();
            assert_noop!(FlopPoui::submit_f1(RuntimeOrigin::signed(1), g,a,n,m,p,c,w,l,o,d,t), Error::<Test>::DuplicateTask);
        });
    }
}
