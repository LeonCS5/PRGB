import React from 'react';
import { LeaderboardModal } from './LeaderboardModal';
import { RankingAccountModal } from './RankingAccountModal';
import { RankingEntryModal } from './RankingEntryModal';
import { useRanking } from '../context/ranking';

// Lives outside the game so these open from anywhere; a native <dialog> stacks over whatever is already open
export const RankingModals: React.FC = () => {
  const { entryMode, isAccountOpen, leaderboardTarget } = useRanking();
  return (
    <>
      {isAccountOpen && <RankingAccountModal />}
      {leaderboardTarget && <LeaderboardModal key={`${leaderboardTarget.songId}:${leaderboardTarget.partId}`} target={leaderboardTarget} />}
      {entryMode && <RankingEntryModal key={entryMode} mode={entryMode} />}
    </>
  );
};
