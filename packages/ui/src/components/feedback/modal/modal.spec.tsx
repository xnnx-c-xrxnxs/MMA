import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
    Modal,
    ModalBody,
    ModalCloseButton,
    ModalContent,
    ModalDescription,
    ModalFooter,
    ModalHeader,
    ModalTitle,
    ModalTrigger,
} from './modal';

describe('Modal', () => {
    it('opens on trigger click', async () => {
        const user = userEvent.setup();

        render(
            <Modal>
                <ModalTrigger>Open</ModalTrigger>
                <ModalContent>
                    <ModalHeader>
                        <ModalTitle>Title</ModalTitle>
                        <ModalCloseButton />
                    </ModalHeader>
                    <ModalBody>
                        <ModalDescription>Body content</ModalDescription>
                    </ModalBody>
                    <ModalFooter />
                </ModalContent>
            </Modal>,
        );

        await user.click(screen.getByText('Open'));
        expect(await screen.findByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Title')).toBeInTheDocument();
    });

    it('shows close button and supports size classes', () => {
        render(
            <Modal defaultOpen>
                <ModalContent size="sm">
                    <ModalHeader>
                        <ModalTitle>Small</ModalTitle>
                        <ModalCloseButton />
                    </ModalHeader>
                    <ModalBody>
                        <ModalDescription>Small body content</ModalDescription>
                    </ModalBody>
                    <ModalFooter />
                </ModalContent>
            </Modal>,
        );

        expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
        expect(screen.getByRole('dialog')).toHaveClass('w-[22rem]');
    });
});
