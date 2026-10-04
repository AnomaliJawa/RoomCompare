import { useRef, useState } from 'react';
import * as store from '../data/store.js';
import { useStore } from '../hooks/useStore.js';
import { filterCommunity } from '../utils/filters.js';
import { FilterBar, FilterDialog } from '../components/community/Filters.jsx';
import { SurveyCard } from '../components/survey/SurveyCard.jsx';
import { NoFilterResults } from '../components/ui/EmptyState.jsx';
import { PageHead } from '../components/ui/PageHead.jsx';
import { cardGrid } from './SurveyListPage.jsx';

export function CommunityPage() {
  const { communitySurveys, communityFilters, starredIds, compareSelection } = useStore();
  const visible = filterCommunity(communitySurveys, communityFilters, starredIds);
  const [filtering, setFiltering] = useState(false);
  const opener = useRef(null);

  return (
    <>
      <PageHead
        title="Community surveys"
        lede="Kos recorded by other people. Filter them, star the ones worth keeping, and add any of them to a comparison."
      />

      <FilterBar
        filters={communityFilters}
        total={communitySurveys.length}
        showing={visible.length}
        onOpen={() => setFiltering(true)}
        openerRef={opener}
      />

      {visible.length ? (
        <div className={cardGrid}>
          {visible.map((survey) => (
            <SurveyCard
              key={survey.id}
              survey={survey}
              variant="community"
              starred={starredIds.includes(survey.id)}
              inCompare={compareSelection.includes(survey.id)}
              liked={store.isLiked(survey.id)}
              likes={store.likeCount(survey.id)}
            />
          ))}
        </div>
      ) : (
        <NoFilterResults />
      )}

      <FilterDialog
        open={filtering}
        onClose={() => {
          setFiltering(false);
          opener.current?.focus();
        }}
      />
    </>
  );
}
