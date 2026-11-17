import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { PostCategory, ReactionType } from '@diriddle/shared-types';
import { PostCard } from '../components/PostCard';
import { PostItem } from '../types/models';

const samplePost: PostItem = {
  id: 'post-test-1',
  anonymous_name: 'Anonymous #0421',
  category: PostCategory.CONFESSION,
  content: 'Cubbon Park walks at 6 AM are the best reset in Bengaluru.',
  status: 'PUBLISHED',
  community_id: 'city-bengaluru',
  community_name: 'Bengaluru',
  city: 'Bengaluru',
  comment_count: 5,
  reaction_count: 12,
  reaction_counts: {
    [ReactionType.LIKE]: 8,
    [ReactionType.HEART]: 4,
  },
  my_reaction: null,
  is_saved: false,
  created_at: new Date().toISOString(),
};

describe('PostCard', () => {
  it('renders anonymous handle, content, and comment count', () => {
    const { getByText } = render(
      <PostCard
        post={samplePost}
        onPress={jest.fn()}
        onReact={jest.fn()}
        onSave={jest.fn()}
        onReport={jest.fn()}
      />
    );

    expect(getByText('Anonymous #0421')).toBeTruthy();
    expect(getByText(samplePost.content)).toBeTruthy();
    expect(getByText('5 comments')).toBeTruthy();
  });

  it('triggers reaction, save, and report callbacks', () => {
    const onReact = jest.fn();
    const onSave = jest.fn();
    const onReport = jest.fn();

    const { getByLabelText } = render(
      <PostCard
        post={samplePost}
        onPress={jest.fn()}
        onReact={onReact}
        onSave={onSave}
        onReport={onReport}
      />
    );

    fireEvent.press(getByLabelText('React Like'));
    expect(onReact).toHaveBeenCalledWith(ReactionType.LIKE);

    fireEvent.press(getByLabelText('Save post'));
    expect(onSave).toHaveBeenCalledTimes(1);

    fireEvent.press(getByLabelText('Report post'));
    expect(onReport).toHaveBeenCalledTimes(1);
  });
});

